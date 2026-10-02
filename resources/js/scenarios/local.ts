import type { PacketDetails, PacketLayer, Scenario, ScenarioStep, ScenarioVariant } from '@/engine/types';
import { NET } from './addressing';
import { ethernet, ipv4, udp } from './builders';

/* ================================================================== */
/* ARP                                                                  */
/* ================================================================== */

const arpLayer = (op: 1 | 2, senderIp: string, senderMac: string, targetIp: string, targetMac: string): PacketLayer => ({
    name: 'ARP',
    layer: 'link',
    fields: [
        { name: 'Opération', value: op === 1 ? '1 (requête)' : '2 (réponse)', level: 2 },
        { name: 'IP de l’émetteur', value: senderIp, level: 2 },
        { name: 'MAC de l’émetteur', value: senderMac, level: 2 },
        { name: 'IP cible', value: targetIp, level: 2 },
        { name: 'MAC cible', value: targetMac, level: 2, explain: op === 1 ? 'Inconnue : c’est justement ce qu’on cherche.' : undefined },
        { name: 'Types', value: 'matériel 1 (Ethernet), protocole 0x0800 (IPv4)', level: 3 },
    ],
});

const arpPackets: Record<string, PacketDetails> = {
    req: {
        id: 'req',
        title: 'Requête ARP diffusée',
        protocol: 'ARP',
        size: '42 octets (60 sur le câble)',
        where: 'Tout le réseau local (diffusion)',
        beginner: { who: 'L’ordinateur.', to: 'Tout le monde sur le réseau local.', why: 'Il cherche l’adresse MAC qui correspond à 192.168.1.1.', next: 'Seul l’appareil qui possède cette adresse répondra.' },
        layers: [ethernet({ src: NET.pc.mac, dst: 'ff:ff:ff:ff:ff:ff', srcLabel: 'ordinateur', dstLabel: 'diffusion', type: '0x0806' }), arpLayer(1, NET.pc.ip, NET.pc.mac, NET.box.lanIp, '00:00:00:00:00:00')],
    },
    rep: {
        id: 'rep',
        title: 'Réponse ARP',
        protocol: 'ARP',
        size: '42 octets (60 sur le câble)',
        where: 'De la box vers l’ordinateur (unicast)',
        beginner: { who: 'La box.', to: 'L’ordinateur seulement.', why: 'Pour lui donner son adresse MAC.', next: 'L’ordinateur la note dans sa table ARP.' },
        layers: [ethernet({ src: NET.box.lanMac, dst: NET.pc.mac, srcLabel: 'box', dstLabel: 'ordinateur', type: '0x0806' }), arpLayer(2, NET.box.lanIp, NET.box.lanMac, NET.pc.ip, NET.pc.mac)],
    },
};

const arpScenario: Scenario = {
    id: 'arp',
    title: 'ARP : qui a cette adresse IP ?',
    summary: 'L’ordinateur découvre l’adresse MAC de la box avant de lui envoyer des paquets.',
    assumptions: ['Adresses MAC de documentation (RFC 7042).', 'Réseau local IPv4 en Ethernet ; en IPv6, NDP remplace ARP.'],
    viewBox: { w: 1000, h: 480 },
    zones: [{ id: 'lan', label: 'Réseau local 192.168.1.0/24 — un seul domaine de diffusion', x: 30, y: 30, w: 940, h: 420, tone: 'lan' }],
    nodes: [
        { id: 'pc', kind: 'laptop', label: 'Ordinateur', sublabel: `${NET.pc.ip}\n${NET.pc.mac}`, x: 160, y: 250, term: 'adresse-mac', description: { 1: 'Il veut envoyer un paquet à la box mais ne connaît que son adresse IP.' }, facts: [{ label: 'IP', value: NET.pc.ip }, { label: 'MAC', value: NET.pc.mac }] },
        { id: 'sw', kind: 'switch', label: 'Commutateur', sublabel: 'intégré à la box', x: 480, y: 250, term: 'commutation', description: { 1: 'Il relie les appareils du réseau local.', 2: 'Une trame de diffusion (ff:ff:ff:ff:ff:ff) est recopiée sur tous ses ports.', 3: 'Il apprend au passage l’adresse MAC source de chaque trame et le port correspondant (table MAC).' } },
        { id: 'box', kind: 'box', label: 'Box', sublabel: `${NET.box.lanIp}\n${NET.box.lanMac}`, x: 820, y: 130, term: 'passerelle', description: { 1: 'La passerelle : c’est elle qui possède 192.168.1.1.' }, facts: [{ label: 'IP', value: NET.box.lanIp }, { label: 'MAC', value: NET.box.lanMac }] },
        { id: 'phone', kind: 'phone', label: 'Téléphone', sublabel: `${NET.phone.ip}\n${NET.phone.mac}`, x: 820, y: 360, description: { 1: 'Un autre appareil du réseau : il reçoit aussi la question, mais ne répond pas puisqu’elle ne le concerne pas.' } },
    ],
    links: [
        { from: 'pc', to: 'sw', medium: 'ethernet' },
        { from: 'sw', to: 'box', medium: 'ethernet' },
        { from: 'sw', to: 'phone', medium: 'wifi' },
    ],
    packets: arpPackets,
    steps: [
        {
            id: 'besoin',
            title: 'Il manque l’adresse MAC de la box',
            focus: ['pc'],
            packets: [],
            terms: ['adresse-ip', 'adresse-mac', 'trame'],
            table: { title: 'Table ARP de l’ordinateur', caption: 'Vide : aucune correspondance connue.', columns: ['Adresse IP', 'Adresse MAC', 'Type'], rows: [] },
            text: {
                1: "Pour envoyer un paquet à la box, l'ordinateur doit le mettre dans une [[trame|trame]] adressée à l'[[adresse-mac|adresse MAC]] de la box. Or il ne connaît que son adresse IP : `192.168.1.1`.",
                2: "Une trame Ethernet exige une adresse MAC de destination. Pour toute destination hors du réseau local, c'est la MAC de la passerelle qu'il faut trouver.",
                3: "La pile IPv4 met le paquet en attente le temps de la résolution (file d'attente par voisin).",
            },
        },
        {
            id: 'diffusion',
            title: 'La question est posée à tout le réseau',
            focus: ['pc', 'sw', 'box', 'phone'],
            details: 'req',
            terms: ['broadcast', 'arp'],
            packets: [
                { id: 'q1', label: 'Qui a .1 ?', tone: 'broadcast', path: ['pc', 'sw'], hop: 1.2, inspect: 'req' },
                { id: 'q2', label: 'Qui a .1 ?', tone: 'broadcast', path: ['sw', 'box'], hop: 1.2, after: 'q1', inspect: 'req' },
                { id: 'q3', label: 'Qui a .1 ?', tone: 'broadcast', path: ['sw', 'phone'], hop: 1.2, after: 'q1', inspect: 'req' },
            ],
            text: {
                1: "L'ordinateur crie à tout le réseau local : « Qui a l'adresse 192.168.1.1 ? Réponds à 192.168.1.10 ». Le commutateur recopie ce message vers tous les appareils.",
                2: "Requête [[arp|ARP]] envoyée en [[broadcast|diffusion]] (`ff:ff:ff:ff:ff:ff`). Elle contient l'IP recherchée et les adresses de l'émetteur.",
                3: "Les récepteurs profitent souvent de la requête pour mettre à jour leur propre table avec l'adresse de l'émetteur.",
            },
        },
        {
            id: 'ignore',
            title: 'Seul le bon appareil répond',
            focus: ['phone', 'box'],
            packets: [],
            bubble: { node: 'phone', text: 'Pas pour moi : j’ignore', side: 'bottom' },
            text: {
                1: "Le téléphone lit la question : ce n'est pas son adresse, il ne répond pas. La box, elle, reconnaît `192.168.1.1` : c'est elle !",
                2: "Chaque appareil compare l'IP cible avec la sienne. Une diffusion dérange tout le monde : c'est pourquoi on limite la taille des domaines de diffusion (VLAN).",
            },
        },
        {
            id: 'reponse',
            title: 'La box répond directement',
            focus: ['box', 'pc'],
            details: 'rep',
            status: 'ok',
            packets: [
                { id: 'r1', label: '.1 est à …:01', tone: 'response', path: ['box', 'sw'], hop: 1.2, inspect: 'rep' },
                { id: 'r2', label: '.1 est à …:01', tone: 'response', path: ['sw', 'pc'], hop: 1.2, after: 'r1', inspect: 'rep' },
            ],
            table: { title: 'Table ARP de l’ordinateur', columns: ['Adresse IP', 'Adresse MAC', 'Type'], rows: [[NET.box.lanIp, NET.box.lanMac, 'dynamique']], highlight: 0, highlightKind: 'new' },
            text: {
                1: "La box répond uniquement à l'ordinateur : « 192.168.1.1, c'est moi, mon adresse MAC est 00:00:5e:00:53:01 ». L'ordinateur note cette réponse dans sa [[table-arp|table ARP]].",
                2: "La réponse est envoyée en unicast. L'entrée « dynamique » expirera après quelques minutes sans utilisation.",
                3: "Commandes utiles : `arp -a` (Windows) ou `ip neigh` (Linux). Une réponse non sollicitée (ARP gratuit) peut aussi mettre à jour les tables — ce qu'exploitent les attaques par usurpation ARP.",
            },
        },
        {
            id: 'cache',
            title: 'La fois suivante, pas besoin de demander',
            focus: ['pc', 'box'],
            status: 'ok',
            packets: [{ id: 'ip', label: 'Paquet IP', tone: 'request', path: ['pc', 'sw', 'box'], hop: 1.1 }],
            table: { title: 'Table ARP de l’ordinateur', columns: ['Adresse IP', 'Adresse MAC', 'Type'], rows: [[NET.box.lanIp, NET.box.lanMac, 'dynamique']], highlight: 0, highlightKind: 'used' },
            text: {
                1: "Maintenant que l'adresse MAC est connue, l'ordinateur envoie directement ses paquets à la box, sans reposer la question.",
                2: "La trame porte la MAC de la box comme destination, mais le paquet IP à l'intérieur peut être destiné à n'importe quel serveur d'Internet.",
                3: "En IPv6, le même travail est fait par NDP : Neighbor Solicitation envoyée à une adresse multicast ciblée, puis Neighbor Advertisement.",
            },
        },
    ],
};

/* ================================================================== */
/* DHCP                                                                 */
/* ================================================================== */

const dhcpLayer = (type: string, fields: { name: string; value: string; level: 2 | 3; explain?: string }[]): PacketLayer => ({
    name: 'DHCP',
    layer: 'app',
    fields: [{ name: 'Type de message (option 53)', value: type, level: 2 }, { name: 'Identifiant de transaction', value: '0x6e1f2a3b', level: 3, explain: 'Le même dans les 4 messages : il relie les réponses à la demande.' }, ...fields],
});

const dhcp = (id: string, title: string, fromClient: boolean, broadcastIp: boolean, type: string, fields: Parameters<typeof dhcpLayer>[1], beginner: PacketDetails['beginner']): PacketDetails => ({
    id,
    title,
    protocol: 'DHCP',
    size: '≈ 342 octets',
    where: fromClient ? 'Du téléphone vers le réseau local' : 'De la box vers le téléphone',
    beginner,
    layers: [
        ethernet({
            src: fromClient ? NET.phone.mac : NET.box.lanMac,
            dst: fromClient ? 'ff:ff:ff:ff:ff:ff' : NET.phone.mac,
            srcLabel: fromClient ? 'téléphone' : 'box',
            dstLabel: fromClient ? 'diffusion' : 'téléphone',
            type: '0x0800',
            note: 'Sur le lien Wi-Fi, la trame réelle est au format 802.11 ; elle est représentée ici en Ethernet pour simplifier.',
        }),
        ipv4({ src: fromClient ? '0.0.0.0' : NET.box.lanIp, dst: broadcastIp ? '255.255.255.255' : NET.phone.ip, ttl: fromClient ? 64 : 64, protocol: 'UDP', totalLength: 328, df: false }),
        udp({ srcPort: fromClient ? 68 : 67, dstPort: fromClient ? 67 : 68, length: 308 }),
        dhcpLayer(type, fields),
    ],
});

const dhcpPackets: Record<string, PacketDetails> = {
    discover: dhcp('discover', 'DHCPDISCOVER', true, true, 'DISCOVER (1)', [{ name: 'Adresse MAC du client', value: NET.phone.mac, level: 2 }, { name: 'Option 55', value: 'paramètres souhaités : masque, routeur, DNS…', level: 3 }], {
        who: 'Le téléphone, qui n’a pas encore d’adresse (0.0.0.0).',
        to: 'Tout le réseau (255.255.255.255).',
        why: 'Pour trouver un serveur DHCP.',
        next: 'Le serveur DHCP fait une offre.',
    }),
    offer: dhcp('offer', 'DHCPOFFER', false, false, 'OFFER (2)', [
        { name: 'Adresse proposée (yiaddr)', value: NET.phone.ip, level: 2 },
        { name: 'Masque (option 1)', value: '255.255.255.0', level: 2 },
        { name: 'Routeur (option 3)', value: NET.box.lanIp, level: 2 },
        { name: 'DNS (option 6)', value: NET.resolver.ip, level: 2 },
        { name: 'Durée du bail (option 51)', value: '86400 s (24 h)', level: 2 },
        { name: 'Serveur (option 54)', value: NET.box.lanIp, level: 3 },
    ], { who: 'La box (serveur DHCP).', to: 'Le téléphone.', why: 'Pour lui proposer une adresse et des réglages.', next: 'Le téléphone accepte l’offre.' }),
    request: dhcp('request', 'DHCPREQUEST', true, true, 'REQUEST (3)', [
        { name: 'Adresse demandée (option 50)', value: NET.phone.ip, level: 2 },
        { name: 'Serveur choisi (option 54)', value: NET.box.lanIp, level: 2, explain: 'Diffusé pour que d’éventuels autres serveurs sachent que leur offre n’est pas retenue.' },
    ], { who: 'Le téléphone.', to: 'Tout le réseau (diffusion).', why: 'Pour accepter officiellement l’offre de la box.', next: 'La box confirme.' }),
    ack: dhcp('ack', 'DHCPACK', false, false, 'ACK (5)', [
        { name: 'Adresse attribuée', value: NET.phone.ip, level: 2 },
        { name: 'Durée du bail', value: '86400 s', level: 2 },
        { name: 'T1 / T2', value: 'renouvellement à 50 % / 87,5 % du bail', level: 3 },
    ], { who: 'La box.', to: 'Le téléphone.', why: 'Pour confirmer l’attribution.', next: 'Le téléphone configure son adresse et peut communiquer.' }),
};

const dhcpScenario: Scenario = {
    id: 'dhcp',
    title: 'DHCP : obtenir une adresse automatiquement',
    summary: 'Un téléphone rejoint le Wi-Fi et reçoit sa configuration de la box.',
    assumptions: [
        'La box joue le rôle de serveur DHCP, comme dans la plupart des foyers.',
        'Selon les clients, l’OFFER et l’ACK peuvent être envoyés en diffusion plutôt qu’en unicast (drapeau BROADCAST).',
        'Le résolveur annoncé (192.0.2.53) est celui du FAI ; beaucoup de box annoncent plutôt leur propre adresse.',
    ],
    viewBox: { w: 1000, h: 440 },
    zones: [{ id: 'lan', label: 'Réseau local 192.168.1.0/24', x: 30, y: 30, w: 940, h: 380, tone: 'lan' }],
    nodes: [
        { id: 'phone', kind: 'phone', label: 'Téléphone', sublabel: 'adresse : aucune', x: 170, y: 230, term: 'dhcp', description: { 1: 'Il vient de se connecter au Wi-Fi mais n’a pas encore d’adresse IP.' }, facts: [{ label: 'MAC', value: NET.phone.mac }] },
        { id: 'box', kind: 'box', label: 'Box', sublabel: `${NET.box.lanIp}\nserveur DHCP`, x: 560, y: 230, term: 'dhcp', description: { 1: 'Elle distribue les adresses de la maison.', 2: 'Plage distribuée : 192.168.1.10 à 192.168.1.250 (exemple).', 3: 'Elle mémorise chaque bail (adresse MAC, adresse IP, échéance).' } },
        { id: 'laptop', kind: 'laptop', label: 'Ordinateur', sublabel: NET.pc.ip, x: 860, y: 110, description: { 1: 'Un appareil déjà configuré : il reçoit aussi les diffusions, sans y répondre.' } },
        { id: 'tv', kind: 'iot', label: 'Télévision', sublabel: '192.168.1.42', x: 860, y: 350, description: { 1: 'Un autre appareil de la maison.' } },
    ],
    links: [
        { from: 'phone', to: 'box', medium: 'wifi' },
        { from: 'box', to: 'laptop', medium: 'ethernet' },
        { from: 'box', to: 'tv', medium: 'wifi' },
    ],
    packets: dhcpPackets,
    steps: [
        {
            id: 'arrivee',
            title: 'Un nouvel appareil arrive sur le réseau',
            focus: ['phone'],
            packets: [],
            terms: ['dhcp', 'adresse-ip'],
            text: {
                1: "Ton téléphone vient de se connecter au Wi-Fi (le mot de passe a été vérifié). Mais pour communiquer, il lui faut une [[adresse-ip|adresse IP]], un masque, une passerelle et un serveur DNS. Il ne connaît rien de tout cela.",
                2: "Sans adresse, il ne peut même pas savoir à qui s'adresser. [[dhcp|DHCP]] résout ce problème en quatre messages : DISCOVER, OFFER, REQUEST, ACK (« DORA »).",
            },
        },
        {
            id: 'discover',
            title: 'D — DISCOVER : « Y a-t-il un serveur DHCP ? »',
            focus: ['phone', 'box', 'laptop', 'tv'],
            details: 'discover',
            terms: ['broadcast'],
            packets: [
                { id: 'd1', label: 'DISCOVER', tone: 'broadcast', path: ['phone', 'box'], hop: 1.3, inspect: 'discover' },
                { id: 'd2', label: 'DISCOVER', tone: 'broadcast', path: ['box', 'laptop'], hop: 1, after: 'd1', inspect: 'discover' },
                { id: 'd3', label: 'DISCOVER', tone: 'broadcast', path: ['box', 'tv'], hop: 1, after: 'd1', inspect: 'discover' },
            ],
            text: {
                1: "Le téléphone envoie un message à **tout le monde** : « Je cherche un serveur DHCP ». Il utilise l'adresse source `0.0.0.0` puisqu'il n'en a pas encore.",
                2: "Diffusion : IP destination `255.255.255.255`, MAC `ff:ff:ff:ff:ff:ff`, UDP du port 68 (client) vers le port 67 (serveur). Les autres appareils reçoivent le message mais l'ignorent.",
                3: "Les diffusions ne traversent pas les routeurs : si le serveur DHCP est sur un autre réseau, le routeur doit jouer le rôle d'agent relais (il renseigne alors le champ giaddr).",
            },
        },
        {
            id: 'offer',
            title: 'O — OFFER : « Je te propose 192.168.1.23 »',
            focus: ['box', 'phone'],
            details: 'offer',
            packets: [{ id: 'o', label: 'OFFER', tone: 'response', path: ['box', 'phone'], hop: 1.3, inspect: 'offer' }],
            text: {
                1: "La box répond avec une proposition : l'adresse `192.168.1.23`, la passerelle `192.168.1.1`, le serveur DNS, et une durée de prêt de 24 heures.",
                2: "L'offre contient l'adresse proposée (champ yiaddr) et les options : masque, routeur, DNS, durée du bail.",
                3: "Avant de proposer, certains serveurs vérifient par un ping que l'adresse est libre. Plusieurs serveurs pourraient faire des offres concurrentes.",
            },
        },
        {
            id: 'request',
            title: 'R — REQUEST : « J’accepte cette offre »',
            focus: ['phone', 'box'],
            details: 'request',
            packets: [
                { id: 'r', label: 'REQUEST', tone: 'broadcast', path: ['phone', 'box'], hop: 1.3, inspect: 'request' },
                { id: 'r2', label: 'REQUEST', tone: 'broadcast', path: ['box', 'laptop'], hop: 1, after: 'r', inspect: 'request' },
                { id: 'r3', label: 'REQUEST', tone: 'broadcast', path: ['box', 'tv'], hop: 1, after: 'r', inspect: 'request' },
            ],
            text: {
                1: "Le téléphone accepte. Il l'annonce encore à tout le monde, pour que d'éventuels autres serveurs sachent que leur offre n'est pas retenue.",
                2: "La requête est diffusée et désigne le serveur choisi (option 54). Le téléphone n'utilise toujours pas l'adresse proposée.",
            },
        },
        {
            id: 'ack',
            title: 'A — ACK : « C’est confirmé »',
            focus: ['box', 'phone'],
            details: 'ack',
            status: 'ok',
            packets: [{ id: 'a', label: 'ACK', tone: 'response', path: ['box', 'phone'], hop: 1.3, inspect: 'ack' }],
            bubble: { node: 'phone', text: '192.168.1.23 configurée ✓', tone: 'ok' },
            table: {
                title: 'Configuration du téléphone',
                columns: ['Paramètre', 'Valeur'],
                rows: [['Adresse IP', `${NET.phone.ip}/24`], ['Passerelle', NET.box.lanIp], ['DNS', NET.resolver.ip], ['Bail', '24 h']],
                highlight: 0,
                highlightKind: 'new',
            },
            text: {
                1: "La box confirme. Le téléphone configure son adresse : il peut maintenant communiquer avec la maison et avec Internet.",
                2: "Le bail est enregistré par la box. Le client vérifie souvent par ARP que personne n'utilise déjà l'adresse avant de l'adopter.",
                3: "Un DHCPNAK serait renvoyé si l'adresse demandée n'était plus valable (par exemple après un changement de réseau).",
            },
        },
        {
            id: 'bail',
            title: 'Le bail et son renouvellement',
            focus: ['phone', 'box'],
            packets: [
                { id: 'ren', label: 'REQUEST (renouvellement)', tone: 'request', path: ['phone', 'box'], hop: 1.2 },
                { id: 'renack', label: 'ACK', tone: 'response', path: ['box', 'phone'], hop: 1.2, after: 'ren' },
            ],
            terms: ['bail-dhcp'],
            text: {
                1: "L'adresse est prêtée, pas donnée. À mi-parcours du prêt, le téléphone demande poliment à la box de le prolonger.",
                2: "Renouvellement à T1 (50 % du bail) par un REQUEST envoyé directement au serveur. Sans réponse, nouvelle tentative à T2 (87,5 %) auprès de n'importe quel serveur.",
                3: "Si aucun serveur ne répond jusqu'à l'expiration, le client abandonne l'adresse. Sans aucun serveur DHCP au démarrage, un système peut s'attribuer une adresse 169.254.x.x (lien-local).",
            },
        },
    ],
};

/* ================================================================== */
/* TLS 1.3                                                              */
/* ================================================================== */

const tlsLayer = (name: string, fields: { name: string; value: string; level: 2 | 3; explain?: string }[]): PacketLayer => ({ name, layer: 'security', fields });

const tlsPackets: Record<string, PacketDetails> = {
    ch: {
        id: 'ch',
        title: 'ClientHello',
        protocol: 'TLSv1.3',
        where: 'Du navigateur vers le serveur (en clair)',
        beginner: { who: 'Le navigateur.', to: 'Le serveur.', why: 'Pour proposer des méthodes de chiffrement et indiquer le site voulu.', next: 'Le serveur choisit et répond.' },
        layers: [
            tlsLayer('TLS — ClientHello', [
                { name: 'Nom du serveur (SNI)', value: NET.domain, level: 2, explain: 'En clair (sauf ECH) : permet au serveur de choisir le bon certificat.' },
                { name: 'Versions proposées', value: 'TLS 1.3, TLS 1.2', level: 2 },
                { name: 'Suites de chiffrement', value: 'TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256', level: 3 },
                { name: 'Partage de clé (key_share)', value: 'X25519 : moitié publique d’un échange Diffie-Hellman', level: 3, explain: 'Le secret commun sera calculé sans jamais circuler sur le réseau.' },
                { name: 'ALPN', value: 'h2, http/1.1', level: 3 },
            ]),
        ],
    },
    sh: {
        id: 'sh',
        title: 'ServerHello + messages chiffrés',
        protocol: 'TLSv1.3',
        where: 'Du serveur vers le navigateur',
        beginner: { who: 'Le serveur.', to: 'Le navigateur.', why: 'Pour choisir les paramètres, envoyer son certificat et prouver qu’il possède la clé privée.', next: 'Le navigateur vérifie le certificat.' },
        layers: [
            tlsLayer('TLS — ServerHello (en clair)', [
                { name: 'Version choisie', value: 'TLS 1.3', level: 2 },
                { name: 'Suite choisie', value: 'TLS_AES_128_GCM_SHA256', level: 2 },
                { name: 'key_share', value: 'moitié publique du serveur (X25519)', level: 3 },
            ]),
            tlsLayer('TLS — messages chiffrés', [
                { name: 'EncryptedExtensions', value: 'ALPN choisi : h2', level: 3 },
                { name: 'Certificate', value: `certificat de ${NET.domain} et chaîne intermédiaire`, level: 2 },
                { name: 'CertificateVerify', value: 'signature avec la clé privée du serveur', level: 2, explain: 'Prouve que le serveur détient la clé privée correspondant au certificat.' },
                { name: 'Finished', value: 'empreinte de toute la négociation', level: 3 },
            ]),
        ],
        note: 'En TLS 1.3, le certificat est chiffré : une capture ordinaire ne le montre pas.',
    },
    alert: {
        id: 'alert',
        title: 'Alerte TLS : certificat refusé',
        protocol: 'TLSv1.3',
        where: 'Du navigateur vers le serveur',
        beginner: { who: 'Le navigateur.', to: 'Le serveur.', why: 'Le certificat ne correspond pas au site demandé.', next: 'La connexion est fermée et une alerte s’affiche.' },
        layers: [tlsLayer('TLS — Alert', [{ name: 'Niveau', value: 'fatal', level: 2 }, { name: 'Description', value: 'bad_certificate (42)', level: 2 }])],
    },
};

const tlsBase = {
    viewBox: { w: 1000, h: 380 },
    zones: [
        { id: 'c', label: 'Navigateur', x: 30, y: 60, w: 260, h: 280, tone: 'home' as const },
        { id: 's', label: 'Serveur', x: 710, y: 60, w: 260, h: 280, tone: 'datacenter' as const },
    ],
    nodes: [
        { id: 'client', kind: 'laptop' as const, label: 'Navigateur', sublabel: 'client TLS', x: 160, y: 190, term: 'client', description: { 1: 'Il veut un canal chiffré avec le vrai serveur de www.example.com.', 2: 'Il possède une liste d’autorités de certification de confiance.' } },
        { id: 'net', kind: 'cloud' as const, label: 'Réseau', sublabel: 'n’importe qui peut écouter', x: 500, y: 190, description: { 1: 'Sur le trajet, des intermédiaires peuvent voir passer les paquets : c’est pour cela qu’on chiffre.' } },
        { id: 'server', kind: 'server' as const, label: 'Serveur', sublabel: NET.domain, x: 840, y: 190, term: 'certificat', description: { 1: 'Il possède un certificat et la clé privée associée.' } },
    ],
    links: [
        { from: 'client', to: 'net', medium: 'wan' as const },
        { from: 'net', to: 'server', medium: 'wan' as const },
    ],
    packets: tlsPackets,
};

const tlsAssumptions = ['TLS 1.3 au-dessus d’une connexion TCP déjà établie.', 'Les valeurs cryptographiques ne sont pas représentées ; les noms d’algorithmes sont des exemples courants.'];
const c2s = ['client', 'net', 'server'];
const s2c = ['server', 'net', 'client'];

const tlsVisibleTable = {
    title: 'Ce que voit un observateur sur le trajet',
    columns: ['Information', 'Visible ?'],
    rows: [
        ['Adresses IP et ports', 'oui'],
        ['Taille et horaires des paquets', 'oui'],
        ['Nom du site (SNI)', 'oui, sauf avec ECH'],
        ['Certificat du serveur (TLS 1.3)', 'non'],
        ['URL complète, cookies, contenu', 'non'],
    ],
};

const tlsSteps: ScenarioStep[] = [
    {
        id: 'pourquoi',
        title: 'Pourquoi chiffrer ?',
        focus: ['net'],
        packets: [],
        terms: ['tls', 'chiffrement'],
        text: {
            1: "Sur Internet, tes données traversent des réseaux que tu ne contrôles pas. [[tls|TLS]] crée un canal **chiffré** et vérifie que tu parles bien au vrai site.",
            2: "TLS apporte trois garanties : confidentialité (chiffrement), intégrité (pas de modification) et authentification du serveur (certificat).",
            3: "TLS 1.3 (RFC 8446) supprime les algorithmes faibles, impose la confidentialité persistante (clés éphémères) et réduit la négociation à un aller-retour.",
        },
    },
    {
        id: 'clienthello',
        title: 'ClientHello : « Voici ce que je sais faire »',
        focus: ['client'],
        details: 'ch',
        terms: ['sni'],
        packets: [{ id: 'p-ch', label: 'ClientHello', tone: 'secure', path: c2s, hop: 1.3, inspect: 'ch' }],
        text: {
            1: "Le navigateur dit bonjour et propose ses méthodes de chiffrement. Il indique aussi le nom du site visé.",
            2: "Le ClientHello contient les versions et algorithmes acceptés, le nom du site ([[sni|SNI]]) et une moitié d'échange de clé.",
            3: "Grâce au key_share envoyé dès le premier message, TLS 1.3 économise un aller-retour par rapport à TLS 1.2.",
        },
    },
    {
        id: 'serverhello',
        title: 'ServerHello et certificat',
        focus: ['server'],
        details: 'sh',
        terms: ['certificat', 'cle-privee'],
        packets: [{ id: 'p-sh', label: 'ServerHello + certificat', tone: 'secure', path: s2c, hop: 1.3, inspect: 'sh' }],
        text: {
            1: "Le serveur choisit une méthode, envoie sa carte d'identité (le [[certificat|certificat]]) et une preuve qu'il est bien son propriétaire.",
            2: "À partir du ServerHello, les deux côtés calculent les mêmes clés secrètes : la suite des messages du serveur est déjà chiffrée.",
            3: "CertificateVerify : signature de la négociation avec la [[cle-privee|clé privée]] du serveur. Finished : contrôle d'intégrité de tout l'échange.",
        },
    },
    {
        id: 'verification',
        title: 'Le navigateur vérifie le certificat',
        focus: ['client'],
        status: 'ok' as const,
        packets: [],
        bubble: { node: 'client', text: 'Certificat valide pour www.example.com ✓', tone: 'ok' as const },
        table: {
            title: 'Vérifications du navigateur',
            columns: ['Contrôle', 'Résultat'],
            rows: [
                ['Le nom correspond au site', 'oui'],
                ['Dates de validité', 'en cours'],
                ['Signé par une autorité de confiance', 'oui (chaîne complète)'],
                ['Signature CertificateVerify', 'correcte'],
            ],
        },
        terms: ['cle-publique'],
        text: {
            1: "Le navigateur vérifie la carte d'identité : est-elle bien au nom de ce site ? Est-elle encore valable ? A-t-elle été délivrée par une autorité de confiance ?",
            2: "Il contrôle la chaîne de certificats jusqu'à une autorité racine connue, les dates et le nom, puis vérifie la signature avec la [[cle-publique|clé publique]] du certificat.",
            3: "Contrôles complémentaires possibles : révocation, Certificate Transparency. Une horloge système fausse fait échouer la vérification des dates.",
        },
    },
    {
        id: 'finished',
        title: 'Finished : le canal chiffré est prêt',
        focus: ['client', 'server'],
        status: 'ok' as const,
        packets: [
            { id: 'p-fin', label: 'Finished', tone: 'secure' as const, path: c2s, hop: 1.1 },
            { id: 'p-data', label: 'Données chiffrées', tone: 'secure' as const, path: c2s, hop: 1.1, after: 'p-fin' },
            { id: 'p-data2', label: 'Données chiffrées', tone: 'secure' as const, path: s2c, hop: 1.1, after: 'p-data' },
        ],
        text: {
            1: "Le navigateur confirme à son tour. À partir de maintenant, tout ce qui circule est chiffré : la page, les mots de passe, les cookies.",
            2: "Les données applicatives voyagent dans des enregistrements « Application Data ». Les clés de session sont différentes pour chaque connexion.",
            3: "Total : un aller-retour TLS après la poignée de main TCP. En reprise de session, des données « 0-RTT » peuvent partir dès le premier message, avec un risque de rejeu.",
        },
    },
    {
        id: 'visible',
        title: 'Ce qui reste visible',
        focus: ['net'],
        packets: [],
        table: tlsVisibleTable,
        text: {
            1: "Le contenu est protégé, mais pas tout : un observateur voit encore avec qui tu communiques, quand, et combien de données circulent.",
            2: "Adresses, ports, tailles, horaires et nom du site (SNI) restent visibles. Le contenu HTTP (URL complète, cookies, pages) est chiffré.",
            3: "ECH (Encrypted Client Hello) chiffre le SNI ; le DNS chiffré (DoH, DoT) masque la résolution. L'adresse IP du serveur reste toujours visible.",
        },
    },
];

const tlsBadSteps: ScenarioStep[] = [
    tlsSteps[0],
    tlsSteps[1],
    tlsSteps[2],
    {
        id: 'refus',
        title: 'Le certificat ne correspond pas',
        focus: ['client'],
        status: 'error' as const,
        details: 'alert',
        packets: [{ id: 'p-alert', label: 'Alert', tone: 'error' as const, path: c2s, hop: 1.2, inspect: 'alert' }],
        bubble: { node: 'client', text: 'Votre connexion n’est pas privée', tone: 'error' as const },
        table: {
            title: 'Vérifications du navigateur',
            columns: ['Contrôle', 'Résultat'],
            rows: [
                ['Le nom correspond au site', 'NON : certificat émis pour autre.example.net'],
                ['Dates de validité', 'en cours'],
                ['Signé par une autorité de confiance', 'oui'],
            ],
            highlight: 0,
            highlightKind: 'used' as const,
        },
        text: {
            1: "Le certificat présenté est au nom d'un autre site. Le navigateur refuse de continuer et affiche un avertissement : il est possible que quelqu'un se fasse passer pour le site.",
            2: "Le navigateur envoie une alerte TLS fatale et ferme la connexion. Aucune donnée applicative n'a été échangée.",
            3: "Causes fréquentes : mauvais certificat installé, nom manquant dans la liste des noms (SAN), interception TLS par un proxy non approuvé, certificat expiré ou horloge fausse.",
        },
    },
];

/* ================================================================== */
/* VLAN                                                                 */
/* ================================================================== */

const dot1q = (vid: number, changed = false): PacketLayer => ({
    name: 'Étiquette 802.1Q',
    layer: 'link',
    fields: [
        { name: 'TPID', value: '0x8100', level: 3, explain: 'Signale la présence de l’étiquette.' },
        { name: 'Priorité (PCP)', value: '0', level: 3 },
        { name: 'VID (identifiant de VLAN)', value: String(vid), level: 2, changed },
    ],
});

const A = { ip: '10.10.10.21', mac: '00:00:5e:00:53:21', gw: '10.10.10.1' };
const B = { ip: '10.20.20.31', mac: '00:00:5e:00:53:31', gw: '10.20.20.1' };
const R_MAC = '00:00:5e:00:53:fe';

const ipAB = (ttl: number, changed = false) => ipv4({ src: A.ip, dst: B.ip, ttl, protocol: 'ICMP', totalLength: 84, changed: changed ? { ttl: true, checksum: true } : undefined });

const vlanPackets: Record<string, PacketDetails> = {
    access: {
        id: 'access',
        title: 'Trame sur le port d’accès (VLAN 10)',
        protocol: 'ICMP',
        where: 'Entre le PC A et le commutateur',
        beginner: { who: 'Le PC A.', to: 'Le PC B, via sa passerelle (le routeur).', why: 'Le PC B est dans un autre réseau : il faut passer par le routeur.', next: 'Le commutateur ajoute l’étiquette du VLAN 10 sur le lien trunk.' },
        layers: [ethernet({ src: A.mac, dst: R_MAC, srcLabel: 'PC A', dstLabel: 'routeur', type: '0x0800' }), ipAB(64)],
        note: 'Sur un port d’accès, la trame n’a pas d’étiquette : le commutateur sait que ce port appartient au VLAN 10.',
    },
    trunkIn: {
        id: 'trunkIn',
        title: 'Trame étiquetée VLAN 10 sur le trunk',
        protocol: 'ICMP',
        where: 'Entre le commutateur et le routeur',
        beginner: { who: 'Le commutateur, pour le PC A.', to: 'Le routeur.', why: 'Plusieurs VLAN partagent ce câble : l’étiquette indique lequel.', next: 'Le routeur route le paquet vers le VLAN 20.' },
        layers: [ethernet({ src: A.mac, dst: R_MAC, srcLabel: 'PC A', dstLabel: 'routeur', type: '0x8100' }), dot1q(10, true), ipAB(64)],
    },
    trunkOut: {
        id: 'trunkOut',
        title: 'Trame étiquetée VLAN 20 après routage',
        protocol: 'ICMP',
        where: 'Entre le routeur et le commutateur',
        beginner: { who: 'Le routeur.', to: 'Le PC B.', why: 'Le paquet a été routé vers le réseau 10.20.20.0/24.', next: 'Le commutateur retire l’étiquette et livre au PC B.' },
        layers: [ethernet({ src: R_MAC, dst: B.mac, srcLabel: 'routeur', dstLabel: 'PC B', type: '0x8100', changed: { src: true, dst: true } }), dot1q(20, true), ipAB(63, true)],
        note: 'Le routage a changé les adresses MAC, l’étiquette (VID 20) et le TTL. Les adresses IP n’ont pas changé.',
    },
};

const vlanScenario: Scenario = {
    id: 'vlan',
    title: 'Deux VLAN sur un même commutateur',
    summary: 'Le PC A (VLAN 10) et le PC B (VLAN 20) sont branchés sur le même commutateur ; un routeur relie les deux VLAN.',
    assumptions: [
        'Configuration « routeur sur un bâton » (router-on-a-stick) : un seul lien trunk vers le routeur, une sous-interface par VLAN.',
        'Plan d’adressage privé illustratif : VLAN 10 = 10.10.10.0/24, VLAN 20 = 10.20.20.0/24.',
        'Scénario illustratif : un commutateur de niveau 3 pourrait aussi assurer le routage inter-VLAN.',
    ],
    viewBox: { w: 1000, h: 520 },
    zones: [
        { id: 'v10', label: 'VLAN 10 — 10.10.10.0/24', x: 30, y: 30, w: 330, h: 220, tone: 'vlan-a' },
        { id: 'v20', label: 'VLAN 20 — 10.20.20.0/24', x: 30, y: 270, w: 330, h: 220, tone: 'vlan-b' },
    ],
    nodes: [
        { id: 'a', kind: 'desktop', label: 'PC A', sublabel: `${A.ip}\nVLAN 10`, x: 140, y: 140, term: 'vlan', description: { 1: 'Un poste du service comptabilité, dans le VLAN 10.', 2: `Passerelle : ${A.gw} (sous-interface VLAN 10 du routeur).` } },
        { id: 'printer', kind: 'iot', label: 'Imprimante', sublabel: '10.10.10.40\nVLAN 10', x: 290, y: 175, description: { 1: 'Une imprimante du VLAN 10.' } },
        { id: 'b', kind: 'desktop', label: 'PC B', sublabel: `${B.ip}\nVLAN 20`, x: 140, y: 390, term: 'vlan', description: { 1: 'Un poste du service commercial, dans le VLAN 20.', 2: `Passerelle : ${B.gw}.` } },
        { id: 'sw', kind: 'switch', label: 'Commutateur', sublabel: 'ports d’accès + trunk', x: 530, y: 260, term: 'commutation', description: { 1: 'Un seul commutateur, mais deux réseaux séparés.', 2: 'Ports du PC A et de l’imprimante : accès VLAN 10. Port du PC B : accès VLAN 20. Port vers le routeur : trunk.', 3: 'Il tient une table MAC par VLAN et ne transmet jamais une trame d’un VLAN vers un autre.' } },
        { id: 'r', kind: 'router', label: 'Routeur', sublabel: '.1 dans chaque VLAN', x: 850, y: 260, term: 'routage', description: { 1: 'Il relie les deux VLAN, comme il relierait deux réseaux différents.', 2: 'Sous-interfaces : 10.10.10.1 (VLAN 10) et 10.20.20.1 (VLAN 20).', 3: 'C’est aussi le bon endroit pour filtrer (listes de contrôle d’accès) le trafic entre services.' } },
    ],
    links: [
        { from: 'a', to: 'sw', medium: 'ethernet' },
        { from: 'printer', to: 'sw', medium: 'ethernet' },
        { from: 'b', to: 'sw', medium: 'ethernet' },
        { from: 'sw', to: 'r', medium: 'trunk', label: 'trunk 802.1Q' },
    ],
    packets: vlanPackets,
    steps: [
        {
            id: 'separation',
            title: 'Un commutateur, deux réseaux',
            focus: ['sw', 'a', 'b'],
            packets: [],
            terms: ['vlan', 'port-access'],
            text: {
                1: "Le PC A et le PC B sont branchés sur le **même** commutateur. Pourtant, ils sont dans deux réseaux séparés, comme s'il y avait deux commutateurs : ce sont des [[vlan|VLAN]].",
                2: "Chaque port est rattaché à un VLAN ([[port-access|port d'accès]]). Le commutateur ne transmet jamais une trame d'un VLAN vers un autre.",
                3: "Chaque VLAN est un domaine de diffusion distinct ; on lui associe généralement un sous-réseau IP, mais ce sont deux notions différentes (couche 2 contre couche 3).",
            },
        },
        {
            id: 'broadcast',
            title: 'Une diffusion reste dans son VLAN',
            focus: ['a', 'sw', 'printer'],
            packets: [
                { id: 'bc1', label: 'ARP (diffusion)', tone: 'broadcast', path: ['a', 'sw'], hop: 1.2 },
                { id: 'bc2', label: 'ARP (diffusion)', tone: 'broadcast', path: ['sw', 'printer'], hop: 1.2, after: 'bc1' },
            ],
            bubble: { node: 'b', text: 'Je ne reçois rien', side: 'bottom' },
            terms: ['broadcast'],
            text: {
                1: "Le PC A envoie un message à « tout le monde » (une diffusion). Seule l'imprimante, dans le même VLAN, le reçoit. Le PC B ne voit rien.",
                2: "Les [[broadcast|diffusions]] sont limitées au VLAN : c'est l'un des intérêts des VLAN, avec la séparation des services.",
            },
        },
        {
            id: 'passerelle',
            title: 'Pour joindre le PC B, il faut un routeur',
            focus: ['a', 'sw'],
            details: 'access',
            packets: [{ id: 'p1', label: 'ping → B', tone: 'request', path: ['a', 'sw'], hop: 1.3, inspect: 'access' }],
            terms: ['sous-reseau', 'passerelle'],
            text: {
                1: "Le PC A veut contacter le PC B (`10.20.20.31`). Cette adresse n'est pas dans son réseau : il confie donc le message à sa [[passerelle|passerelle]], le routeur.",
                2: "`10.20.20.31` n'appartient pas à `10.10.10.0/24` → la trame est adressée à la MAC du routeur. Sur le port d'accès, la trame n'a pas d'étiquette.",
            },
        },
        {
            id: 'tag',
            title: 'Sur le trunk, la trame porte l’étiquette VLAN 10',
            focus: ['sw', 'r'],
            details: 'trunkIn',
            packets: [{ id: 'p2', label: 'VLAN 10', tone: 'request', path: ['sw', 'r'], hop: 1.4, inspect: 'trunkIn' }],
            terms: ['trunk'],
            text: {
                1: "Le câble vers le routeur transporte plusieurs VLAN. Le commutateur ajoute donc une petite étiquette : « ce message vient du VLAN 10 ».",
                2: "Étiquette IEEE 802.1Q de 4 octets, insérée après l'adresse MAC source, avec le VID = 10. C'est un lien [[trunk|trunk]].",
                3: "Champs : TPID 0x8100, PCP (priorité, 3 bits), DEI (1 bit), VID (12 bits : 4094 VLAN utilisables).",
            },
        },
        {
            id: 'route',
            title: 'Le routeur passe du VLAN 10 au VLAN 20',
            focus: ['r', 'sw'],
            details: 'trunkOut',
            packets: [{ id: 'p3', label: 'VLAN 20', tone: 'response', path: ['r', 'sw'], hop: 1.4, delay: 0.6, inspect: 'trunkOut' }],
            bubble: { node: 'r', text: '10.20.20.31 → sous-interface VLAN 20', side: 'bottom' },
            terms: ['routage'],
            text: {
                1: "Le routeur lit l'adresse de destination, voit qu'elle appartient au VLAN 20, et renvoie le message sur le même câble avec l'étiquette « VLAN 20 ».",
                2: "Routage inter-VLAN : nouvel en-tête Ethernet (MAC du routeur → MAC du PC B), étiquette VID 20, TTL décrémenté. Les adresses IP ne changent pas.",
                3: "Le routeur doit connaître la MAC du PC B : il l'a apprise par ARP dans le VLAN 20. Des listes de contrôle d'accès peuvent autoriser ou interdire ce trafic.",
            },
        },
        {
            id: 'livraison',
            title: 'Le commutateur retire l’étiquette et livre au PC B',
            focus: ['sw', 'b'],
            status: 'ok',
            packets: [{ id: 'p4', label: 'ping', tone: 'response', path: ['sw', 'b'], hop: 1.3 }],
            text: {
                1: "Le commutateur reçoit le message étiqueté « VLAN 20 », retire l'étiquette et le livre au PC B. La communication entre les deux VLAN a réussi… grâce au routeur.",
                2: "Sur le port d'accès du PC B, la trame redevient non étiquetée. La réponse du PC B suivra le chemin inverse.",
                3: "À retenir : segmentation de couche 2 (VLAN), adressage de couche 3 (sous-réseaux) et contrôle de sécurité (filtrage au routeur ou au pare-feu) sont trois mécanismes complémentaires.",
            },
        },
    ],
};

/* ================================================================== */
/* Traceroute                                                           */
/* ================================================================== */

const traceRows = (rows: string[][]) => ({
    title: 'Résultat de traceroute (construit au fil des sondes)',
    columns: ['Saut', 'Adresse', 'Temps'],
    rows,
    highlight: rows.length - 1,
    highlightKind: 'new' as const,
});

const hops = [
    ['1', NET.box.lanIp, '1 ms'],
    ['2', '203.0.113.1', '8 ms'],
    ['3', '* * *', '—'],
    ['4', '198.51.100.1', '30 ms'],
    ['5', NET.server.ip, '31 ms'],
];

const icmpTe = (router: string): PacketDetails => ({
    id: `te-${router}`,
    title: 'ICMP Time Exceeded',
    protocol: 'ICMP',
    where: `Du routeur ${router} vers l’ordinateur`,
    beginner: { who: `Le routeur ${router}.`, to: 'Ton ordinateur.', why: 'Le TTL de la sonde est tombé à 0 chez lui : il prévient l’expéditeur.', next: 'Traceroute note l’adresse de ce routeur et le temps de réponse.' },
    layers: [
        ipv4({ src: router, dst: NET.pc.ip, ttl: 64, protocol: 'ICMP', totalLength: 56 }),
        {
            name: 'ICMP',
            layer: 'network',
            fields: [
                { name: 'Type / code', value: '11 / 0 (Time Exceeded, TTL expiré en transit)', level: 2 },
                { name: 'Contenu', value: 'en-tête IP + début de la sonde d’origine', level: 3, explain: 'Permet à traceroute d’associer la réponse à la sonde envoyée.' },
            ],
        },
    ],
});

const probe = (ttl: number): PacketDetails => ({
    id: `probe-${ttl}`,
    title: `Sonde avec TTL = ${ttl}`,
    protocol: 'UDP',
    where: 'Depuis l’ordinateur',
    beginner: { who: 'Ton ordinateur (traceroute).', to: 'Le serveur, mais la sonde n’ira pas jusque-là.', why: `Elle ne peut faire que ${ttl} saut${ttl > 1 ? 's' : ''} avant d’être détruite.`, next: 'Le routeur où le TTL tombe à 0 répond.' },
    layers: [
        ipv4({ src: NET.pc.ip, dst: NET.server.ip, ttl, protocol: 'UDP', totalLength: 60, df: false }),
        udp({ srcPort: 42001, dstPort: 33433 + ttl * 3 - 2, length: 40, note: 'Sous Linux, traceroute envoie par défaut des sondes UDP vers des ports élevés (à partir de 33434). La commande Windows tracert utilise ICMP Echo.' }),
    ],
});

const traceNodes = [
    { id: 'pc', kind: 'laptop' as const, label: 'Ordinateur', sublabel: NET.pc.ip, x: 80, y: 260, term: 'ttl', description: { 1: 'Il lance la commande traceroute www.example.com.' } },
    { id: 'box', kind: 'box' as const, label: 'Box', sublabel: NET.box.lanIp, x: 245, y: 260, term: 'passerelle', description: { 1: 'Premier routeur rencontré.' } },
    { id: 'isp', kind: 'router' as const, label: 'Routeur FAI', sublabel: '203.0.113.1', x: 415, y: 260, term: 'fai', description: { 1: 'Deuxième saut.' } },
    { id: 'r1', kind: 'router' as const, label: 'Routeur A', sublabel: 'ne répond pas', x: 585, y: 260, term: 'routage', description: { 1: 'Ce routeur transmet le trafic mais ne renvoie pas de messages ICMP (filtrage ou limitation).', 2: 'Il apparaît comme « * * * » dans le résultat.' } },
    { id: 'r2', kind: 'router' as const, label: 'Routeur B', sublabel: '198.51.100.1', x: 755, y: 260, term: 'routage', description: { 1: 'Quatrième saut, proche du serveur.' } },
    { id: 'server', kind: 'server' as const, label: 'Serveur', sublabel: NET.server.ip, x: 920, y: 260, term: 'serveur', description: { 1: 'La destination finale.' } },
];
const traceLinks = [
    { from: 'pc', to: 'box', medium: 'ethernet' as const },
    { from: 'box', to: 'isp', medium: 'fiber' as const },
    { from: 'isp', to: 'r1', medium: 'wan' as const },
    { from: 'r1', to: 'r2', medium: 'wan' as const },
    { from: 'r2', to: 'server', medium: 'ethernet' as const },
];
const order = ['pc', 'box', 'isp', 'r1', 'r2', 'server'];
const there = (n: number) => order.slice(0, n + 1);
const backFrom = (n: number) => order.slice(0, n + 1).reverse();

const tracePackets: Record<string, PacketDetails> = {
    'probe-1': probe(1),
    'probe-2': probe(2),
    'probe-3': probe(3),
    'probe-4': probe(4),
    'probe-5': probe(5),
    [`te-${NET.box.lanIp}`]: icmpTe(NET.box.lanIp),
    'te-203.0.113.1': icmpTe('203.0.113.1'),
    'te-198.51.100.1': icmpTe('198.51.100.1'),
    unreachable: {
        id: 'unreachable',
        title: 'ICMP Port Unreachable — la destination est atteinte',
        protocol: 'ICMP',
        where: 'Du serveur vers l’ordinateur',
        beginner: { who: 'Le serveur.', to: 'Ton ordinateur.', why: 'La sonde est arrivée, mais aucun programme n’écoute sur ce port UDP : il le signale.', next: 'Traceroute sait que la destination est atteinte et s’arrête.' },
        layers: [
            ipv4({ src: NET.server.ip, dst: NET.pc.ip, ttl: 60, protocol: 'ICMP', totalLength: 56 }),
            { name: 'ICMP', layer: 'network', fields: [{ name: 'Type / code', value: '3 / 3 (Destination Unreachable, port injoignable)', level: 2 }] },
        ],
        note: 'Avec tracert (ICMP), c’est un Echo Reply qui signale l’arrivée.',
    },
};

const traceScenario: Scenario = {
    id: 'traceroute',
    title: 'Traceroute : révéler le chemin',
    summary: 'Des sondes au TTL croissant font répondre chaque routeur du trajet.',
    assumptions: [
        'Chemin illustratif de 5 sauts ; un vrai trajet en compte souvent bien plus.',
        'Une seule sonde par saut est animée (traceroute en envoie 3 par défaut).',
        'Adresses de documentation (RFC 5737).',
    ],
    viewBox: { w: 1000, h: 440 },
    zones: [
        { id: 'home', label: 'Maison', x: 20, y: 150, w: 310, h: 220, tone: 'home' },
        { id: 'internet', label: 'Internet', x: 345, y: 150, w: 635, h: 220, tone: 'internet' },
    ],
    nodes: traceNodes,
    links: traceLinks,
    packets: tracePackets,
    steps: [
        {
            id: 'principe',
            title: 'L’astuce : le TTL',
            focus: ['pc'],
            packets: [],
            terms: ['ttl', 'routage'],
            text: {
                1: "Chaque paquet porte un compteur, le [[ttl|TTL]]. Chaque routeur le diminue de 1 ; à zéro, le paquet est détruit et le routeur prévient l'expéditeur.\n\nTraceroute exploite ce mécanisme pour découvrir les routeurs un par un.",
                2: "Traceroute envoie des sondes avec TTL = 1, puis 2, puis 3… Chaque routeur où le TTL tombe à 0 renvoie un message ICMP **Time Exceeded** qui révèle son adresse.",
                3: "Le TTL a été conçu pour empêcher les paquets de tourner indéfiniment en cas de boucle de routage ; traceroute (1987) le détourne astucieusement.",
            },
        },
        {
            id: 'ttl1',
            title: 'TTL = 1 : la box se dévoile',
            focus: ['box'],
            details: 'probe-1',
            packets: [
                { id: 'p1', label: 'TTL=1', tone: 'request', path: there(1), hop: 1.2, lost: true, inspect: 'probe-1' },
                { id: 'te1', label: 'Time Exceeded', tone: 'error', path: backFrom(1), hop: 1.2, after: 'p1', inspect: `te-${NET.box.lanIp}` },
            ],
            table: traceRows(hops.slice(0, 1)),
            text: {
                1: "La première sonde ne peut faire qu'un saut. La box la reçoit, le compteur tombe à 0 : elle la détruit et répond « délai dépassé ». On connaît le premier saut !",
                2: "Saut 1 : `192.168.1.1`, environ 1 ms. Le temps affiché est le temps aller-retour de la sonde.",
            },
        },
        {
            id: 'ttl2',
            title: 'TTL = 2 : le routeur du fournisseur d’accès',
            focus: ['isp'],
            details: 'probe-2',
            packets: [
                { id: 'p2', label: 'TTL=2', tone: 'request', path: there(2), hop: 0.9, lost: true, inspect: 'probe-2' },
                { id: 'te2', label: 'Time Exceeded', tone: 'error', path: backFrom(2), hop: 0.9, after: 'p2', inspect: 'te-203.0.113.1' },
            ],
            table: traceRows(hops.slice(0, 2)),
            text: {
                1: "La deuxième sonde passe la box (TTL 2 → 1) et s'arrête au routeur du FAI, qui répond à son tour.",
                2: "Saut 2 : `203.0.113.1`. Le routeur répond avec l'adresse de l'interface par laquelle il a reçu la sonde (ou une autre, selon sa configuration).",
            },
        },
        {
            id: 'ttl3',
            title: 'TTL = 3 : pas de réponse',
            focus: ['r1'],
            status: 'warning',
            details: 'probe-3',
            packets: [{ id: 'p3', label: 'TTL=3', tone: 'request', path: there(3), hop: 0.9, lost: true, inspect: 'probe-3' }],
            table: traceRows(hops.slice(0, 3)),
            text: {
                1: "Le routeur A détruit bien la sonde… mais ne répond pas. Traceroute affiche des étoiles. Ce n'est pas forcément une panne : la suite le montrera.",
                2: "« * * * » : aucune réponse dans le délai imparti. Beaucoup de routeurs filtrent ou limitent l'envoi de messages ICMP.",
                3: "Si les sauts suivants répondent, le trafic traverse bien ce routeur. Seule une absence de réponse persistante jusqu'à la fin suggère un blocage.",
            },
        },
        {
            id: 'ttl4',
            title: 'TTL = 4 : le routeur B',
            focus: ['r2'],
            details: 'probe-4',
            packets: [
                { id: 'p4', label: 'TTL=4', tone: 'request', path: there(4), hop: 0.75, lost: true, inspect: 'probe-4' },
                { id: 'te4', label: 'Time Exceeded', tone: 'error', path: backFrom(4), hop: 0.75, after: 'p4', inspect: 'te-198.51.100.1' },
            ],
            table: traceRows(hops.slice(0, 4)),
            text: {
                1: "La quatrième sonde traverse le routeur A (qui fonctionne donc bien) et s'arrête au routeur B, qui répond.",
                2: "Saut 4 : `198.51.100.1`, environ 30 ms. L'écart de temps entre deux sauts peut révéler un lien long (par exemple un câble sous-marin).",
            },
        },
        {
            id: 'ttl5',
            title: 'TTL = 5 : la destination est atteinte',
            focus: ['server'],
            status: 'ok',
            details: 'probe-5',
            packets: [
                { id: 'p5', label: 'TTL=5', tone: 'request', path: there(5), hop: 0.7, inspect: 'probe-5' },
                { id: 'un', label: 'Port Unreachable', tone: 'response', path: backFrom(5), hop: 0.7, after: 'p5', inspect: 'unreachable' },
            ],
            table: traceRows(hops),
            text: {
                1: "La dernière sonde atteint le serveur. Celui-ci répond d'une autre façon, ce qui indique à traceroute qu'il est arrivé au bout.",
                2: "Avec des sondes UDP, le serveur répond « port injoignable » (ICMP type 3, code 3). Avec tracert (ICMP Echo), il répond par un Echo Reply.",
                3: "Limites : chemin aller uniquement, chemins multiples possibles (partage de charge), routeurs masqués dans des tunnels MPLS. Des outils comme mtr ou Paris-traceroute affinent la mesure.",
            },
        },
    ],
};

export const arpVariants: ScenarioVariant[] = [{ id: 'arp', label: 'Résolution ARP', description: arpScenario.summary, scenario: arpScenario }];
export const dhcpVariants: ScenarioVariant[] = [{ id: 'dora', label: 'DISCOVER, OFFER, REQUEST, ACK', description: dhcpScenario.summary, scenario: dhcpScenario }];
export const tlsVariants: ScenarioVariant[] = [
    { id: 'reussite', label: 'Négociation réussie', description: 'TLS 1.3 complet, vérification du certificat.', scenario: { id: 'tls-ok', title: 'Négociation TLS 1.3', summary: 'ClientHello, ServerHello, vérification, Finished.', assumptions: tlsAssumptions, ...tlsBase, steps: tlsSteps } },
    { id: 'certificat-invalide', label: 'Certificat invalide', description: 'Le certificat ne correspond pas au site : la connexion est refusée.', status: 'error', scenario: { id: 'tls-bad', title: 'Certificat refusé', summary: 'Le navigateur détecte un certificat qui ne correspond pas au site.', assumptions: tlsAssumptions, ...tlsBase, steps: tlsBadSteps } },
];
export const vlanVariants: ScenarioVariant[] = [{ id: 'inter-vlan', label: 'Routage inter-VLAN', description: vlanScenario.summary, scenario: vlanScenario }];
export const traceVariants: ScenarioVariant[] = [{ id: 'traceroute', label: 'Traceroute', description: traceScenario.summary, scenario: traceScenario }];
