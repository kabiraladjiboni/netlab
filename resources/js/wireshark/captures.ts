import { NET } from '@/scenarios/addressing';
import { buildCapture } from './build';
import type { Capture } from './types';

/**
 * Captures pédagogiques construites à la main (adresses de documentation).
 * Elles sont cohérentes avec la leçon « Accéder à Internet » mais ne
 * proviennent d'aucun trafic réel.
 */

const pcEth = { src: NET.pc.mac, dst: NET.box.lanMac };
const toPc = { src: NET.box.lanMac, dst: NET.pc.mac };
const out = (ttl = 64) => ({ src: NET.pc.ip, dst: NET.server.ip, ttl });
const back = (ttl = 60) => ({ src: NET.server.ip, dst: NET.pc.ip, ttl });
const C = NET.ports.client;
const lessonLink = (variant: string | null, label: string) => ({ href: `/lecons/acces-internet${variant ? `?variante=${variant}` : ''}`, label });

const httpsVisit: Capture = {
    id: 'visite-https',
    title: 'Visite de https://www.example.com',
    description: 'ARP, DNS, poignée de main TCP, négociation TLS 1.3 puis échange HTTP chiffré, capturés sur l’ordinateur.',
    pedagogical: true,
    packets: buildCapture([
        {
            time: 0,
            eth: { src: NET.pc.mac, dst: 'ff:ff:ff:ff:ff:ff' },
            arp: { op: 1, senderMac: NET.pc.mac, senderIp: NET.pc.ip, targetMac: '00:00:00:00:00:00', targetIp: NET.box.lanIp },
            beginner: 'L’ordinateur demande à tout le réseau local qui possède l’adresse 192.168.1.1 (la box), pour connaître son adresse MAC.',
            role: 'Résolution d’adresse locale (ARP), nécessaire avant tout envoi vers la passerelle.',
            lesson: lessonLink(null, 'Étape « Trouver l’adresse MAC de la box »'),
        },
        {
            time: 0.000812,
            eth: toPc,
            arp: { op: 2, senderMac: NET.box.lanMac, senderIp: NET.box.lanIp, targetMac: NET.pc.mac, targetIp: NET.pc.ip },
            beginner: 'La box répond : « 192.168.1.1, c’est moi, voici mon adresse MAC ».',
            role: 'Réponse ARP, envoyée directement à l’ordinateur.',
        },
        {
            time: 0.001204,
            eth: pcEth,
            ip: { src: NET.pc.ip, dst: NET.resolver.ip, ttl: 64, id: '0x5a10', df: false },
            udp: { sport: NET.ports.dnsClient, dport: 53 },
            dns: { id: '0x3f2a', response: false, name: NET.domain, type: 'A' },
            beginner: 'L’ordinateur demande au résolveur DNS l’adresse IP de www.example.com.',
            role: 'Requête DNS (UDP, port 53).',
            lesson: lessonLink(null, 'Étape « Demander l’adresse IP au résolveur DNS »'),
        },
        {
            time: 0.019511,
            eth: toPc,
            ip: { src: NET.resolver.ip, dst: NET.pc.ip, ttl: 60, id: '0x9b21', df: false },
            udp: { sport: 53, dport: NET.ports.dnsClient },
            dns: { id: '0x3f2a', response: true, name: NET.domain, type: 'A', answer: NET.server.ip, ttl: 300 },
            beginner: 'Le résolveur répond : l’adresse de www.example.com est 198.51.100.20.',
            role: 'Réponse DNS, même identifiant 0x3f2a que la question.',
        },
        {
            time: 0.020102,
            eth: pcEth,
            ip: out(),
            tcp: { sport: C, dport: 443, seq: 0, ack: 0, flags: ['SYN'], win: 64240, options: 'MSS=1460 SACK_PERM TSval=… TSecr=0 WS=128', optionsLength: 20, payload: 0 },
            beginner: 'L’ordinateur demande à ouvrir une connexion avec le serveur (premier message de la poignée de main TCP).',
            role: 'SYN : ouverture de connexion TCP vers le port 443.',
            lesson: lessonLink(null, 'Étape « Le premier paquet part vers la box »'),
        },
        {
            time: 0.051033,
            eth: toPc,
            ip: back(),
            tcp: { sport: 443, dport: C, seq: 0, ack: 1, flags: ['SYN', 'ACK'], win: 65160, options: 'MSS=1460 SACK_PERM TSval=… TSecr=… WS=128', optionsLength: 20, payload: 0 },
            beginner: 'Le serveur accepte la connexion.',
            role: 'SYN-ACK : le serveur synchronise son numéro de séquence et acquitte le SYN. Le délai depuis le SYN (≈ 31 ms) donne une idée du temps aller-retour.',
            lesson: lessonLink(null, 'Étape « Le serveur répond : SYN-ACK »'),
        },
        {
            time: 0.051101,
            eth: pcEth,
            ip: out(),
            tcp: { sport: C, dport: 443, seq: 1, ack: 1, flags: ['ACK'], win: 502, options: 'NOP NOP TSval=… TSecr=…', optionsLength: 12, payload: 0 },
            beginner: 'L’ordinateur confirme : la connexion est ouverte.',
            role: 'ACK : fin de la poignée de main en trois temps.',
        },
        {
            time: 0.051512,
            eth: pcEth,
            ip: out(),
            tcp: { sport: C, dport: 443, seq: 1, ack: 1, flags: ['PSH', 'ACK'], win: 502, optionsLength: 12, payload: 517 },
            tls: { records: ['Client Hello'], sni: NET.domain },
            beginner: 'Le navigateur propose des méthodes de chiffrement et indique le nom du site. Ce nom est visible en clair.',
            role: 'TLS ClientHello avec l’extension SNI.',
            lesson: lessonLink(null, 'Étape « Connexion ouverte, puis négociation TLS »'),
        },
        {
            time: 0.082741,
            eth: toPc,
            ip: back(),
            tcp: { sport: 443, dport: C, seq: 1, ack: 518, flags: ['ACK'], win: 509, optionsLength: 12, payload: 1448 },
            tls: { records: ['Server Hello', 'Change Cipher Spec', 'Application Data'] },
            beginner: 'Le serveur répond avec ses choix ; tout ce qui suit le « Server Hello » est déjà chiffré, y compris son certificat.',
            role: 'ServerHello puis messages de handshake chiffrés (affichés comme Application Data).',
        },
        {
            time: 0.082802,
            eth: toPc,
            ip: back(),
            tcp: { sport: 443, dport: C, seq: 1449, ack: 518, flags: ['PSH', 'ACK'], win: 509, optionsLength: 12, payload: 1000 },
            tls: { records: ['Application Data'] },
            beginner: 'Suite des messages chiffrés du serveur (certificat, preuve d’identité, fin de négociation).',
            role: 'Fin du handshake TLS du serveur, chiffrée.',
        },
        {
            time: 0.083010,
            eth: pcEth,
            ip: out(),
            tcp: { sport: C, dport: 443, seq: 518, ack: 2449, flags: ['ACK'], win: 501, optionsLength: 12, payload: 0 },
            beginner: 'L’ordinateur accuse réception des données du serveur.',
            role: 'ACK : acquitte jusqu’à l’octet 2449.',
        },
        {
            time: 0.084522,
            eth: pcEth,
            ip: out(),
            tcp: { sport: C, dport: 443, seq: 518, ack: 2449, flags: ['PSH', 'ACK'], win: 501, optionsLength: 12, payload: 64 },
            tls: { records: ['Change Cipher Spec', 'Application Data'] },
            beginner: 'Le navigateur termine la négociation : le canal chiffré est prêt.',
            role: 'Finished du client (chiffré).',
        },
        {
            time: 0.084910,
            eth: pcEth,
            ip: out(),
            tcp: { sport: C, dport: 443, seq: 582, ack: 2449, flags: ['PSH', 'ACK'], win: 501, optionsLength: 12, payload: 210 },
            tls: { records: ['Application Data'] },
            beginner: 'Le navigateur envoie sa requête (« donne-moi la page d’accueil »), entièrement chiffrée : on ne voit ni l’adresse de la page ni les cookies.',
            role: 'Requête HTTP chiffrée (Application Data).',
            lesson: lessonLink(null, 'Étape « La requête HTTP, chiffrée »'),
        },
        {
            time: 0.121700,
            eth: toPc,
            ip: back(),
            tcp: { sport: 443, dport: C, seq: 2449, ack: 792, flags: ['ACK'], win: 509, optionsLength: 12, payload: 1448 },
            tls: { records: ['Application Data'] },
            beginner: 'Le serveur envoie la page, découpée en plusieurs segments, toujours chiffrée.',
            role: 'Réponse HTTP chiffrée, segment de 1448 octets (MSS moins les options d’horodatage).',
            lesson: lessonLink(null, 'Étape « Le serveur renvoie la page »'),
        },
        {
            time: 0.121802,
            eth: toPc,
            ip: back(),
            tcp: { sport: 443, dport: C, seq: 3897, ack: 792, flags: ['PSH', 'ACK'], win: 509, optionsLength: 12, payload: 1200 },
            tls: { records: ['Application Data'] },
            beginner: 'La fin de la page arrive.',
            role: 'Dernier segment de la réponse (PSH : à remettre à l’application sans attendre).',
        },
        {
            time: 0.122010,
            eth: pcEth,
            ip: out(),
            tcp: { sport: C, dport: 443, seq: 792, ack: 5097, flags: ['ACK'], win: 501, optionsLength: 12, payload: 0 },
            beginner: 'L’ordinateur confirme avoir tout reçu.',
            role: 'ACK : 5097 = 3897 + 1200.',
        },
    ]),
    missions: [
        { id: 'm1', kind: 'select', prompt: 'Clique sur le paquet qui demande l’adresse IP de www.example.com.', answer: [3], hint: 'Cherche le protocole DNS, envoyé par l’ordinateur (192.168.1.10).', explanation: 'Le paquet 3 est une requête DNS (« Standard query … A www.example.com ») envoyée au résolveur 192.0.2.53.' },
        { id: 'm2', kind: 'select', prompt: 'Trouve le premier message de la poignée de main TCP.', answer: [5], hint: 'Il porte le drapeau [SYN] seul.', explanation: 'Le paquet 5 porte uniquement le drapeau SYN : c’est la demande d’ouverture de connexion vers le port 443.' },
        { id: 'm3', kind: 'filter', prompt: 'Écris un filtre d’affichage qui ne montre que le trafic DNS.', answer: [3, 4], hint: 'Le nom du protocole suffit comme filtre.', explanation: 'Le filtre « dns » affiche la question (3) et la réponse (4). « udp.port == 53 » fonctionne aussi.' },
        { id: 'm4', kind: 'filter', prompt: 'Affiche uniquement les segments TCP qui portent le drapeau SYN.', answer: [5, 6], hint: 'Les drapeaux s’écrivent tcp.flags.<nom> et valent 1 quand ils sont positionnés.', explanation: '« tcp.flags.syn == 1 » affiche le SYN (5) et le SYN-ACK (6).' },
        { id: 'm5', kind: 'select', prompt: 'Malgré HTTPS, un paquet TLS laisse voir le nom du site en clair. Lequel ?', answer: [8], hint: 'C’est le tout premier message TLS du navigateur.', explanation: 'Le ClientHello (8) contient l’extension SNI « www.example.com » en clair, sauf si ECH est utilisé.' },
        { id: 'm6', kind: 'filter', prompt: 'Affiche tous les paquets échangés avec le serveur 198.51.100.20, dans les deux sens.', answer: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], hint: 'Le champ ip.addr correspond à la source OU à la destination.', explanation: '« ip.addr == 198.51.100.20 » sélectionne les paquets dont la source ou la destination est le serveur.' },
    ],
};

const httpClear: Capture = {
    id: 'http-clair',
    title: 'Page Web en HTTP non chiffré (serveur de test)',
    description: 'Pour comparer : sans TLS, la requête et la réponse se lisent en clair dans la capture.',
    pedagogical: true,
    packets: buildCapture([
        { time: 0, eth: pcEth, ip: { src: NET.pc.ip, dst: '198.51.100.30', ttl: 64 }, tcp: { sport: 51600, dport: 80, seq: 0, ack: 0, flags: ['SYN'], win: 64240, options: 'MSS=1460 SACK_PERM TSval=… TSecr=0 WS=128', optionsLength: 20, payload: 0 }, beginner: 'Ouverture de connexion vers le port 80 (HTTP sans chiffrement).', role: 'SYN' },
        { time: 0.028, eth: toPc, ip: { src: '198.51.100.30', dst: NET.pc.ip, ttl: 60 }, tcp: { sport: 80, dport: 51600, seq: 0, ack: 1, flags: ['SYN', 'ACK'], win: 65160, options: 'MSS=1460 SACK_PERM TSval=… TSecr=… WS=128', optionsLength: 20, payload: 0 }, beginner: 'Le serveur accepte.', role: 'SYN-ACK' },
        { time: 0.0281, eth: pcEth, ip: { src: NET.pc.ip, dst: '198.51.100.30', ttl: 64 }, tcp: { sport: 51600, dport: 80, seq: 1, ack: 1, flags: ['ACK'], win: 502, optionsLength: 12, payload: 0 }, beginner: 'Connexion établie.', role: 'ACK' },
        { time: 0.0284, eth: pcEth, ip: { src: NET.pc.ip, dst: '198.51.100.30', ttl: 64 }, tcp: { sport: 51600, dport: 80, seq: 1, ack: 1, flags: ['PSH', 'ACK'], win: 502, optionsLength: 12, payload: 92 }, http: { request: { method: 'GET', uri: '/index.html', host: 'test.example' } }, beginner: 'Le navigateur demande la page /index.html. Ici, tout est lisible : adresse de la page, en-têtes… et ce serait aussi le cas d’un mot de passe.', role: 'Requête HTTP en clair.' },
        { time: 0.0562, eth: toPc, ip: { src: '198.51.100.30', dst: NET.pc.ip, ttl: 60 }, tcp: { sport: 80, dport: 51600, seq: 1, ack: 93, flags: ['ACK'], win: 509, optionsLength: 12, payload: 0 }, beginner: 'Le serveur confirme avoir reçu la requête.', role: 'ACK' },
        { time: 0.0571, eth: toPc, ip: { src: '198.51.100.30', dst: NET.pc.ip, ttl: 60 }, tcp: { sport: 80, dport: 51600, seq: 1, ack: 93, flags: ['PSH', 'ACK'], win: 509, optionsLength: 12, payload: 612 }, http: { response: { code: 200, reason: 'OK', type: 'text/html' } }, beginner: 'Le serveur renvoie la page : son contenu HTML est lisible dans la capture.', role: 'Réponse HTTP 200 en clair.' },
        { time: 0.0573, eth: pcEth, ip: { src: NET.pc.ip, dst: '198.51.100.30', ttl: 64 }, tcp: { sport: 51600, dport: 80, seq: 93, ack: 613, flags: ['ACK'], win: 501, optionsLength: 12, payload: 0 }, beginner: 'L’ordinateur confirme la réception.', role: 'ACK' },
    ]),
    missions: [
        { id: 'h1', kind: 'select', prompt: 'Dans quel paquet lit-on l’adresse de la page demandée ?', answer: [4], hint: 'Cherche la méthode GET.', explanation: 'Le paquet 4 contient « GET /index.html HTTP/1.1 » : sans TLS, l’URL est visible.' },
        { id: 'h2', kind: 'filter', prompt: 'Affiche uniquement les messages HTTP.', answer: [4, 6], hint: 'Le nom du protocole suffit.', explanation: '« http » affiche la requête (4) et la réponse (6). En HTTPS, ce filtre n’afficherait rien sans les clés de déchiffrement.' },
    ],
};

const diagnosis: Capture = {
    id: 'diagnostic',
    title: 'Diagnostic : ping, port filtré et port fermé',
    description: 'Un ping qui fonctionne, une connexion qui reste sans réponse (retransmissions) et une connexion refusée (RST).',
    pedagogical: true,
    packets: buildCapture([
        { time: 0, eth: pcEth, ip: out(), icmp: { type: 8, code: 0, id: 1, seq: 1, data: 56 }, beginner: 'L’ordinateur envoie un « ping » au serveur.', role: 'ICMP Echo Request.' },
        { time: 0.031207, eth: toPc, ip: back(), icmp: { type: 0, code: 0, id: 1, seq: 1, data: 56 }, beginner: 'Le serveur répond : il est joignable. Le TTL reçu (60) suggère 4 routeurs si sa valeur initiale est 64.', role: 'ICMP Echo Reply.' },
        { time: 1.001534, eth: pcEth, ip: out(), icmp: { type: 8, code: 0, id: 1, seq: 2, data: 56 }, beginner: 'Deuxième ping.', role: 'ICMP Echo Request.' },
        { time: 1.032011, eth: toPc, ip: back(), icmp: { type: 0, code: 0, id: 1, seq: 2, data: 56 }, beginner: 'Deuxième réponse, environ 30 ms plus tard.', role: 'ICMP Echo Reply.' },
        { time: 2.410022, eth: pcEth, ip: out(), tcp: { sport: 51520, dport: 8443, seq: 0, ack: 0, flags: ['SYN'], win: 64240, options: 'MSS=1460 SACK_PERM TSval=… TSecr=0 WS=128', optionsLength: 20, payload: 0, stream: 1 }, beginner: 'Tentative de connexion au port 8443.', role: 'SYN.', lesson: lessonLink('port-bloque', 'Variante « Port bloqué »') },
        { time: 3.411877, eth: pcEth, ip: out(), tcp: { sport: 51520, dport: 8443, seq: 0, ack: 0, flags: ['SYN'], win: 64240, options: 'MSS=1460 SACK_PERM TSval=… TSecr=0 WS=128', optionsLength: 20, payload: 0, retransmission: true, stream: 1 }, beginner: 'Pas de réponse au bout d’une seconde : l’ordinateur renvoie son SYN.', role: 'Retransmission du SYN (délai d’environ 1 s).' },
        { time: 5.427940, eth: pcEth, ip: out(), tcp: { sport: 51520, dport: 8443, seq: 0, ack: 0, flags: ['SYN'], win: 64240, options: 'MSS=1460 SACK_PERM TSval=… TSecr=0 WS=128', optionsLength: 20, payload: 0, retransmission: true, stream: 1 }, beginner: 'Toujours rien : nouvel essai, deux secondes plus tard. Le paquet est probablement détruit par un pare-feu.', role: 'Retransmission (le délai double).' },
        { time: 6.10011, eth: pcEth, ip: out(), tcp: { sport: 51522, dport: 8080, seq: 0, ack: 0, flags: ['SYN'], win: 64240, options: 'MSS=1460 SACK_PERM TSval=… TSecr=0 WS=128', optionsLength: 20, payload: 0, stream: 2 }, beginner: 'Tentative de connexion au port 8080.', role: 'SYN.' },
        { time: 6.131402, eth: toPc, ip: back(), tcp: { sport: 8080, dport: 51522, seq: 1, ack: 1, flags: ['RST', 'ACK'], win: 0, payload: 0, stream: 2 }, beginner: 'Le serveur refuse aussitôt : aucun programme n’écoute sur ce port.', role: 'RST, ACK : connexion refusée.', lesson: lessonLink('echec-serveur', 'Variante « Échec de connexion »') },
    ]),
    missions: [
        { id: 'd1', kind: 'filter', prompt: 'Affiche uniquement les retransmissions TCP.', answer: [6, 7], hint: 'Wireshark range ses diagnostics sous tcp.analysis.', explanation: '« tcp.analysis.retransmission » affiche les deux SYN renvoyés (6 et 7). Ce champ n’est pas dans le paquet : c’est une analyse calculée par Wireshark.' },
        { id: 'd2', kind: 'select', prompt: 'Quel paquet prouve que le port 8080 est fermé (et pas filtré) ?', answer: [9], hint: 'Un port fermé répond, un port filtré se tait.', explanation: 'Le paquet 9 est un RST, ACK envoyé par le serveur : il est joignable mais rien n’écoute sur 8080.' },
        { id: 'd3', kind: 'filter', prompt: 'Affiche les échanges ICMP (le ping).', answer: [1, 2, 3, 4], hint: 'Le nom du protocole suffit.', explanation: '« icmp » affiche les deux demandes et les deux réponses.' },
        { id: 'd4', kind: 'select', prompt: 'Sélectionne une réponse au ping et lis son TTL : combien de routeurs semblent séparer le serveur de l’ordinateur ?', answer: [2, 4], hint: 'Le TTL part souvent de 64 et diminue de 1 par routeur.', explanation: 'TTL reçu : 60. Si le serveur part de 64, il y a eu 4 routeurs. C’est une estimation : la valeur initiale dépend du système.' },
    ],
};

const dhcpCapture: Capture = {
    id: 'dhcp',
    title: 'Arrivée d’un téléphone sur le réseau (DHCP)',
    description: 'L’échange DISCOVER, OFFER, REQUEST, ACK, puis une vérification ARP de l’adresse obtenue.',
    pedagogical: true,
    packets: buildCapture([
        { time: 0, eth: { src: NET.phone.mac, dst: 'ff:ff:ff:ff:ff:ff' }, ip: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 64, df: false }, udp: { sport: 68, dport: 67 }, dhcp: { type: 'Discover', xid: '0x6e1f2a3b' }, beginner: 'Le téléphone, sans adresse, cherche un serveur DHCP en s’adressant à tout le réseau.', role: 'DHCP Discover (diffusion).', lesson: { href: '/lecons/dhcp', label: 'Leçon DHCP' } },
        { time: 0.004102, eth: { src: NET.box.lanMac, dst: NET.phone.mac }, ip: { src: NET.box.lanIp, dst: NET.phone.ip, ttl: 64, df: false }, udp: { sport: 67, dport: 68 }, dhcp: { type: 'Offer', xid: '0x6e1f2a3b', yiaddr: NET.phone.ip, mask: '255.255.255.0', router: NET.box.lanIp, dns: NET.resolver.ip, lease: 86400 }, beginner: 'La box propose l’adresse 192.168.1.23, la passerelle, le DNS et une durée de bail.', role: 'DHCP Offer.' },
        { time: 0.005033, eth: { src: NET.phone.mac, dst: 'ff:ff:ff:ff:ff:ff' }, ip: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 64, df: false }, udp: { sport: 68, dport: 67 }, dhcp: { type: 'Request', xid: '0x6e1f2a3b' }, beginner: 'Le téléphone accepte l’offre, en le disant à tout le monde.', role: 'DHCP Request (diffusion).' },
        { time: 0.008950, eth: { src: NET.box.lanMac, dst: NET.phone.mac }, ip: { src: NET.box.lanIp, dst: NET.phone.ip, ttl: 64, df: false }, udp: { sport: 67, dport: 68 }, dhcp: { type: 'ACK', xid: '0x6e1f2a3b', yiaddr: NET.phone.ip, mask: '255.255.255.0', router: NET.box.lanIp, dns: NET.resolver.ip, lease: 86400 }, beginner: 'La box confirme : l’adresse est attribuée pour 24 heures.', role: 'DHCP ACK.' },
        { time: 0.011230, eth: { src: NET.phone.mac, dst: 'ff:ff:ff:ff:ff:ff' }, arp: { op: 1, senderMac: NET.phone.mac, senderIp: '0.0.0.0', targetMac: '00:00:00:00:00:00', targetIp: NET.phone.ip }, beginner: 'Le téléphone vérifie que personne d’autre n’utilise déjà l’adresse reçue.', role: 'Sonde ARP (adresse source 0.0.0.0).' },
    ]),
    missions: [
        { id: 'p1', kind: 'filter', prompt: 'Affiche uniquement les messages DHCP.', answer: [1, 2, 3, 4], hint: 'Le protocole s’appelle « dhcp » dans les versions récentes de Wireshark (anciennement « bootp »).', explanation: '« dhcp » affiche les quatre messages D-O-R-A.' },
        { id: 'p2', kind: 'select', prompt: 'Dans quel paquet l’adresse est-elle proposée pour la première fois ?', answer: [2], hint: 'C’est la réponse du serveur au Discover.', explanation: 'L’Offer (2) contient « Your (client) IP address : 192.168.1.23 ».' },
    ],
};

export const captures: Capture[] = [httpsVisit, httpClear, diagnosis, dhcpCapture];
