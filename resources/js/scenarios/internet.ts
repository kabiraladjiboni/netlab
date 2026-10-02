import type { PacketDetails, PacketLayer, Scenario, ScenarioStep, ScenarioVariant, SceneLink, SceneNode, SceneZone } from '@/engine/types';
import { assumptionsCommon, NET } from './addressing';
import { ethernet, ipv4, relSeq, tcp, udp } from './builders';

/**
 * Leçon principale : « Comment accède-t-on à Internet depuis chez soi ? »
 * Le scénario est construit à partir de briques communes, puis décliné en
 * variantes (DNS en cache, résolution complète, QUIC, pannes…).
 */

type TopologyOptions = { dnsHierarchy?: boolean; firewall?: boolean; boxDown?: boolean };

const P = NET.ports;
const pcSock = `${NET.pc.ip}:${P.client}`;
const natSock = `${NET.box.wanIp}:${P.natted}`;
const srvSock = `${NET.server.ip}:${P.https}`;

/* ------------------------------------------------------------------ */
/* Topologie                                                            */
/* ------------------------------------------------------------------ */

function topology(options: TopologyOptions = {}): { nodes: SceneNode[]; links: SceneLink[]; zones: SceneZone[] } {
    const nodes: SceneNode[] = [
        {
            id: 'pc',
            kind: 'laptop',
            label: 'Ordinateur',
            sublabel: NET.pc.ip,
            x: 85,
            y: 350,
            term: 'adresse-ip',
            description: {
                1: "C'est ton ordinateur. Le navigateur Web y fonctionne : c'est lui qui veut afficher le site.",
                2: "Le poste client. Il possède une [[adresse-privee|adresse IP privée]] (`192.168.1.10`) attribuée par la box via [[dhcp|DHCP]] et une adresse MAC propre à sa carte réseau.",
                3: 'Le poste client : pile TCP/IP du système, résolveur DNS local (stub resolver), cache DNS et table ARP. Il initie toutes les connexions de ce scénario.',
            },
            facts: [
                { label: 'Adresse IP', value: `${NET.pc.ip}/24` },
                { label: 'Passerelle', value: NET.box.lanIp, level: 2 },
                { label: 'Serveur DNS', value: NET.resolver.ip, level: 2 },
                { label: 'Adresse MAC', value: NET.pc.mac, level: 2 },
                { label: 'Système', value: 'TTL initial 64 (hypothèse)', level: 3 },
            ],
        },
        {
            id: 'box',
            kind: 'box',
            label: 'Box',
            sublabel: `${NET.box.lanIp}\n${NET.box.wanIp}`,
            x: 250,
            y: 350,
            term: 'passerelle',
            description: {
                1: "La box relie ta maison à Internet. Elle est la « porte de sortie » de tous les appareils du foyer et partage avec eux une seule adresse publique.",
                2: "La box combine plusieurs fonctions : routeur (passerelle par défaut), [[nat|NAT/PAT]], serveur [[dhcp|DHCP]], commutateur Ethernet, point d'accès Wi-Fi et souvent relais DNS.",
                3: "Côté LAN : `192.168.1.1/24`. Côté WAN : adresse publique `203.0.113.25` attribuée par le FAI. Elle décrémente le TTL, maintient une table de traduction (conntrack) et applique un pare-feu à états qui bloque les connexions entrantes non sollicitées.",
            },
            facts: [
                { label: 'Adresse côté maison', value: `${NET.box.lanIp}/24` },
                { label: 'Adresse publique', value: NET.box.wanIp },
                { label: 'MAC côté maison', value: NET.box.lanMac, level: 2 },
                { label: 'Fonctions', value: 'routeur, NAT/PAT, DHCP, Wi-Fi, pare-feu', level: 2 },
            ],
        },
        {
            id: 'isp',
            kind: 'router',
            label: 'Routeur du FAI',
            sublabel: 'réseau d’accès',
            x: 450,
            y: 350,
            term: 'fai',
            description: {
                1: "Le fournisseur d'accès à Internet (FAI) relie les maisons de ses clients au reste d'Internet. Ce routeur est la première étape après ta box.",
                2: "Le réseau du FAI collecte le trafic des clients (fibre, ADSL, 4G…) et l'achemine vers Internet. Ce routeur transmet les paquets selon leur adresse IP de destination.",
                3: "En réalité, plusieurs équipements interviennent (OLT pour la fibre, BNG/BRAS pour l'authentification et l'adressage, routeurs de cœur, souvent MPLS) avant les points d'interconnexion avec d'autres opérateurs.",
            },
            facts: [{ label: 'Rôle', value: 'routage vers Internet' }, { label: 'Protocoles possibles', value: 'IP, MPLS, BGP, PPPoE…', level: 3 }],
        },
        {
            id: 'resolver',
            kind: 'dns',
            label: 'Résolveur DNS',
            sublabel: NET.resolver.ip,
            x: 450,
            y: 150,
            term: 'resolveur-dns',
            description: {
                1: "Ce serveur sait retrouver l'adresse IP correspondant à un nom de site, un peu comme un annuaire.",
                2: "Résolveur DNS récursif fourni par le FAI (on pourrait aussi utiliser un résolveur public). Il garde les réponses en cache pendant leur durée de validité (TTL).",
                3: "Il effectue la résolution itérative (racine → TLD → serveur faisant autorité) lorsque la réponse n'est pas en cache, et peut valider DNSSEC.",
            },
            facts: [{ label: 'Adresse IP', value: NET.resolver.ip }, { label: 'Port', value: '53 (UDP, et TCP si besoin)', level: 2 }],
        },
        {
            id: 'r1',
            kind: 'router',
            label: 'Routeur A',
            sublabel: 'Internet',
            x: 620,
            y: 270,
            term: 'routage',
            description: {
                1: 'Un routeur quelque part sur Internet. Il lit l’adresse de destination et envoie le paquet dans la bonne direction.',
                2: "Routeur d'un opérateur de transit. Il choisit le prochain saut grâce à sa table de routage.",
                3: 'Les routes inter-opérateurs sont apprises par BGP ; la décision locale applique la règle du préfixe le plus long.',
            },
        },
        {
            id: 'r2',
            kind: 'router',
            label: 'Routeur B',
            sublabel: 'Internet',
            x: 770,
            y: 380,
            term: 'routage',
            description: {
                1: 'Un autre routeur, plus proche du serveur.',
                2: "Routeur proche du centre de données qui héberge le site.",
                3: "Chaque routeur : TTL − 1, nouvel en-tête de liaison, recalcul de la somme de contrôle IPv4.",
            },
        },
        {
            id: 'server',
            kind: 'server',
            label: 'Serveur Web',
            sublabel: NET.server.ip,
            x: 925,
            y: 300,
            term: 'serveur',
            description: {
                1: 'L’ordinateur qui héberge le site. Il attend les demandes des navigateurs et leur renvoie les pages.',
                2: "Serveur HTTPS à l'écoute sur le port 443. Il ne voit que l'adresse publique de la box, jamais l'adresse privée de l'ordinateur.",
                3: "Pile TCP du serveur, terminaison TLS (certificat pour www.example.com), serveur HTTP. En production, il se trouve souvent derrière un équilibreur de charge ou un CDN.",
            },
            facts: [{ label: 'Adresse IP', value: NET.server.ip }, { label: 'Service', value: 'HTTPS, port 443', level: 2 }],
        },
    ];

    const links: SceneLink[] = [
        { from: 'pc', to: 'box', medium: 'ethernet' },
        { from: 'box', to: 'isp', medium: 'fiber' },
        { from: 'isp', to: 'resolver', medium: 'ethernet' },
        { from: 'isp', to: 'r1', medium: 'wan' },
        { from: 'r1', to: 'r2', medium: 'wan' },
    ];

    if (options.firewall) {
        nodes.find((node) => node.id === 'server')!.x = 935;
        nodes.push({
            id: 'fw',
            kind: 'firewall',
            label: 'Pare-feu',
            sublabel: 'filtrage',
            x: 860,
            y: 220,
            term: 'pare-feu',
            description: {
                1: "Un pare-feu laisse passer ou bloque le trafic selon des règles. Ici, il protège le serveur.",
                2: "Pare-feu placé devant le serveur. Sa règle bloque les connexions vers le port 443 (erreur de configuration volontaire du scénario).",
                3: "Action « DROP » : le paquet est détruit sans réponse. Une action « REJECT » renverrait un TCP RST ou un message ICMP « destination injoignable », ce qui donnerait un échec immédiat au lieu d'une attente.",
            },
        });
        links.push({ from: 'r2', to: 'fw', medium: 'ethernet' }, { from: 'fw', to: 'server', medium: 'ethernet' });
    } else {
        links.push({ from: 'r2', to: 'server', medium: 'ethernet' });
    }

    const zones: SceneZone[] = [
        { id: 'home', label: 'Maison', x: 20, y: 225, w: 320, h: 250, tone: 'home' },
        { id: 'isp', label: 'Fournisseur d’accès', x: 355, y: 60, w: 195, h: 415, tone: 'isp' },
        { id: 'internet', label: 'Internet', x: 565, y: options.dnsHierarchy ? 190 : 60, w: 260, h: options.dnsHierarchy ? 285 : 415, tone: 'internet' },
        { id: 'dc', label: 'Hébergeur', x: 840, y: 130, w: 145, h: 345, tone: 'datacenter' },
    ];

    if (options.dnsHierarchy) {
        nodes.push(
            {
                id: 'root',
                kind: 'dns',
                label: 'Serveur racine',
                sublabel: '« . »',
                x: 610,
                y: 100,
                term: 'dns',
                description: {
                    1: "Le sommet de l'annuaire d'Internet. Il ne connaît pas l'adresse du site, mais sait qui gère les noms en « .com ».",
                    2: "Il existe 13 identités de serveurs racine (a à m.root-servers.net), répliquées dans des centaines de sites grâce à l'anycast.",
                    3: 'Réponse de type « délégation » (referral) : enregistrements NS de la zone com. accompagnés des adresses de ces serveurs (glue).',
                },
            },
            {
                id: 'tld',
                kind: 'dns',
                label: 'Serveur .com',
                sublabel: 'TLD',
                x: 760,
                y: 100,
                term: 'dns',
                description: {
                    1: 'Il gère tous les noms qui se terminent par « .com ». Il sait quel serveur connaît example.com.',
                    2: 'Serveur de domaine de premier niveau (TLD). Il délègue example.com à ses serveurs faisant autorité.',
                    3: 'Réponse : NS de la zone example.com (délégation), sans la réponse finale.',
                },
            },
            {
                id: 'auth',
                kind: 'dns',
                label: 'Serveur faisant autorité',
                sublabel: 'example.com',
                x: 905,
                y: 75,
                term: 'dns',
                description: {
                    1: "C'est le serveur officiel du domaine example.com : lui seul donne la réponse finale.",
                    2: "Serveur faisant autorité pour la zone example.com. Il renvoie l'enregistrement A de www.example.com.",
                    3: 'Réponse avec le drapeau AA (Authoritative Answer) à 1 et un TTL fixé par l’administrateur de la zone.',
                },
            },
        );
        links.push(
            { from: 'resolver', to: 'root', medium: 'logical' },
            { from: 'resolver', to: 'tld', medium: 'logical' },
            { from: 'resolver', to: 'auth', medium: 'logical' },
        );
        zones.push({ id: 'dns', label: 'Hiérarchie DNS', x: 565, y: 40, w: 420, h: 135, tone: 'dns' });
        zones.find((zone) => zone.id === 'dc')!.y = 190;
        zones.find((zone) => zone.id === 'dc')!.h = 285;
    }

    if (options.boxDown) {
        const box = nodes.find((node) => node.id === 'box')!;
        box.sublabel = 'éteinte / débranchée';
    }

    return { nodes, links, zones };
}

/* ------------------------------------------------------------------ */
/* Détails des paquets                                                  */
/* ------------------------------------------------------------------ */

const accessLink = (note: string): PacketLayer => ({
    name: "Liaison d'accès",
    layer: 'link',
    note,
    fields: [
        { name: 'Technologie', value: 'dépend de l’abonnement (GPON, PPPoE sur fibre/DSL, 4G…)', level: 2, changed: true, explain: "L'en-tête Ethernet de la maison a été retiré par la box ; un nouvel en-tête adapté au lien d'accès le remplace." },
    ],
});

const routerLink: PacketLayer = {
    name: 'Ethernet (entre routeurs)',
    layer: 'link',
    fields: [
        { name: 'MAC source', value: 'interface du routeur précédent', level: 2, changed: true, explain: 'Chaque saut réécrit l’en-tête de liaison.' },
        { name: 'MAC destination', value: 'interface du routeur suivant', level: 2, changed: true },
    ],
};

const synOptions = 'MSS = 1460, SACK autorisé, horodatage, NOP, facteur d’échelle de fenêtre = 7';

function synTcp(srcPort: number, changed = false) {
    return tcp({
        srcPort,
        dstPort: 443,
        seq: relSeq(0, NET.tcp.clientIsn),
        ack: '0',
        flags: '0x002 (SYN)',
        window: 64240,
        headerLength: 40,
        options: synOptions,
        changed: changed ? { srcPort: true, checksum: true } : undefined,
    });
}

function synAckTcp(dstPort: number, changed = false) {
    return tcp({
        srcPort: 443,
        dstPort,
        seq: relSeq(0, NET.tcp.serverIsn),
        ack: relSeq(1, NET.tcp.clientIsn + 1),
        flags: '0x012 (SYN, ACK)',
        window: 65160,
        headerLength: 40,
        options: 'MSS = 1460, SACK autorisé, horodatage, NOP, facteur d’échelle de fenêtre = 7',
        changed: changed ? { dstPort: true, checksum: true } : undefined,
    });
}

const packets: Record<string, PacketDetails> = {
    'arp-request': {
        id: 'arp-request',
        title: 'Requête ARP : « Qui a 192.168.1.1 ? »',
        protocol: 'ARP',
        size: '42 octets (complétée à 60 octets sur le câble)',
        where: 'Réseau local, diffusée à tous les appareils',
        beginner: {
            who: 'Ton ordinateur.',
            to: 'Tous les appareils du réseau local (diffusion).',
            why: "Il connaît l'adresse IP de la box mais pas son adresse MAC, indispensable pour lui envoyer une trame.",
            next: 'Seule la box, qui possède 192.168.1.1, va répondre.',
        },
        layers: [
            ethernet({ src: NET.pc.mac, dst: 'ff:ff:ff:ff:ff:ff', srcLabel: 'ordinateur', dstLabel: 'diffusion', type: '0x0806' }),
            {
                name: 'ARP',
                layer: 'link',
                note: "ARP fait le lien entre la couche réseau (IPv4) et la couche liaison (Ethernet). Il n'est jamais routé : il reste dans le réseau local.",
                fields: [
                    { name: 'Opération', value: '1 (requête)', level: 2 },
                    { name: 'IP de l’émetteur', value: NET.pc.ip, level: 2 },
                    { name: 'MAC de l’émetteur', value: NET.pc.mac, level: 2 },
                    { name: 'IP recherchée', value: NET.box.lanIp, level: 2 },
                    { name: 'MAC recherchée', value: '00:00:00:00:00:00 (inconnue)', level: 2 },
                    { name: 'Type matériel / protocole', value: '1 (Ethernet) / 0x0800 (IPv4)', level: 3 },
                    { name: 'Longueurs', value: 'MAC 6 octets, IP 4 octets', level: 3 },
                ],
            },
        ],
    },
    'arp-reply': {
        id: 'arp-reply',
        title: 'Réponse ARP : « 192.168.1.1, c’est moi »',
        protocol: 'ARP',
        size: '42 octets (60 sur le câble)',
        where: 'Réseau local, envoyée directement à l’ordinateur',
        beginner: {
            who: 'La box.',
            to: 'Ton ordinateur uniquement.',
            why: 'Pour lui communiquer son adresse MAC.',
            next: "L'ordinateur la mémorise dans sa table ARP et peut enfin envoyer des trames à la box.",
        },
        layers: [
            ethernet({ src: NET.box.lanMac, dst: NET.pc.mac, srcLabel: 'box', dstLabel: 'ordinateur', type: '0x0806' }),
            {
                name: 'ARP',
                layer: 'link',
                fields: [
                    { name: 'Opération', value: '2 (réponse)', level: 2 },
                    { name: 'IP de l’émetteur', value: NET.box.lanIp, level: 2 },
                    { name: 'MAC de l’émetteur', value: NET.box.lanMac, level: 2 },
                    { name: 'IP cible', value: NET.pc.ip, level: 3 },
                    { name: 'MAC cible', value: NET.pc.mac, level: 3 },
                ],
            },
        ],
    },
    'dns-query': {
        id: 'dns-query',
        title: 'Requête DNS : adresse de www.example.com ?',
        protocol: 'DNS',
        size: '≈ 75 octets (sans extension EDNS)',
        where: 'Entre l’ordinateur et la box (avant traduction NAT)',
        beginner: {
            who: 'Ton ordinateur.',
            to: 'Le résolveur DNS du fournisseur d’accès.',
            why: 'Pour obtenir l’adresse IP qui correspond au nom www.example.com.',
            next: 'Le résolveur cherche la réponse et la renvoie.',
        },
        layers: [
            ethernet({ src: NET.pc.mac, dst: NET.box.lanMac, srcLabel: 'ordinateur', dstLabel: 'box', type: '0x0800' }),
            ipv4({ src: NET.pc.ip, dst: NET.resolver.ip, ttl: 64, protocol: 'UDP', totalLength: 61, id: '0x5a10', df: false }),
            udp({ srcPort: P.dnsClient, dstPort: 53, length: 41 }),
            {
                name: 'DNS',
                layer: 'app',
                fields: [
                    { name: 'Question', value: 'www.example.com, type A, classe IN', level: 2 },
                    { name: 'Identifiant', value: '0x3f2a', level: 3, explain: 'Permet d’associer la réponse à la question.' },
                    { name: 'Drapeaux', value: '0x0100 (requête standard, RD = 1)', level: 3, explain: 'RD (Recursion Desired) : le client demande au résolveur de faire tout le travail.' },
                    { name: 'Compteurs', value: '1 question, 0 réponse', level: 3 },
                ],
            },
        ],
    },
    'dns-response': {
        id: 'dns-response',
        title: 'Réponse DNS : 198.51.100.20',
        protocol: 'DNS',
        size: '≈ 91 octets',
        where: 'Entre la box et l’ordinateur (après traduction inverse)',
        beginner: {
            who: 'Le résolveur DNS.',
            to: 'Ton ordinateur.',
            why: 'Pour donner l’adresse IP du site demandé.',
            next: 'L’ordinateur garde la réponse en cache et peut contacter le serveur.',
        },
        layers: [
            ethernet({ src: NET.box.lanMac, dst: NET.pc.mac, srcLabel: 'box', dstLabel: 'ordinateur', type: '0x0800' }),
            ipv4({ src: NET.resolver.ip, dst: NET.pc.ip, ttl: 60, protocol: 'UDP', totalLength: 77, id: '0x9b21', df: false }),
            udp({ srcPort: 53, dstPort: P.dnsClient, length: 57 }),
            {
                name: 'DNS',
                layer: 'app',
                fields: [
                    { name: 'Réponse', value: 'www.example.com → A 198.51.100.20', level: 2 },
                    { name: 'Durée de validité (TTL)', value: '300 s (illustratif)', level: 2 },
                    { name: 'Identifiant', value: '0x3f2a (identique à la question)', level: 3 },
                    { name: 'Drapeaux', value: '0x8180 (réponse, RD = 1, RA = 1, RCODE = 0 NOERROR)', level: 3 },
                ],
            },
        ],
    },
    'syn-lan': {
        id: 'syn-lan',
        title: 'Segment SYN — sur le réseau de la maison',
        protocol: 'TCP',
        size: '74 octets',
        where: 'Entre l’ordinateur et la box',
        beginner: {
            who: 'Ton ordinateur (le navigateur).',
            to: 'Le serveur Web de www.example.com.',
            why: 'Pour demander l’ouverture d’une connexion.',
            next: 'La box va traduire l’adresse avant d’envoyer le paquet sur Internet.',
        },
        layers: [
            ethernet({ src: NET.pc.mac, dst: NET.box.lanMac, srcLabel: 'ordinateur', dstLabel: 'box', type: '0x0800' }),
            ipv4({ src: NET.pc.ip, dst: NET.server.ip, ttl: 64, protocol: 'TCP', totalLength: 60 }),
            synTcp(P.client),
        ],
        note: "L'adresse IP de destination est celle du serveur, mais l'adresse MAC de destination est celle de la box : chaque couche a son propre destinataire.",
    },
    'syn-wan': {
        id: 'syn-wan',
        title: 'Segment SYN — après la traduction NAT',
        protocol: 'TCP',
        size: 'variable selon le lien d’accès',
        where: 'À la sortie de la box, vers le fournisseur d’accès',
        beginner: {
            who: 'Officiellement, la box (elle a remplacé l’adresse de l’ordinateur par la sienne).',
            to: 'Le serveur Web.',
            why: 'Une adresse privée n’est pas utilisable sur Internet.',
            next: 'Le paquet part vers le réseau du fournisseur d’accès.',
        },
        layers: [
            accessLink('La technologie du lien d’accès dépend de l’abonnement.'),
            ipv4({ src: NET.box.wanIp, dst: NET.server.ip, ttl: 63, protocol: 'TCP', totalLength: 60, changed: { src: true, ttl: true, checksum: true } }),
            synTcp(P.natted, true),
        ],
        note: 'Champs modifiés par la box : IP source et port source (NAT/PAT), TTL (routage), sommes de contrôle (recalcul). La destination est inchangée.',
    },
    'syn-internet': {
        id: 'syn-internet',
        title: 'Segment SYN — entre deux routeurs d’Internet',
        protocol: 'TCP',
        size: '74 octets sur un lien Ethernet',
        where: 'Entre le routeur A et le routeur B',
        beginner: {
            who: 'La box (adresse publique), au nom de ton ordinateur.',
            to: 'Le serveur Web.',
            why: 'Le paquet poursuit sa route vers le serveur.',
            next: 'Le routeur B le transmet au centre de données.',
        },
        layers: [
            routerLink,
            ipv4({ src: NET.box.wanIp, dst: NET.server.ip, ttl: 61, protocol: 'TCP', totalLength: 60, changed: { ttl: true, checksum: true } }),
            synTcp(P.natted),
        ],
        note: 'Depuis la box, seuls le TTL, la somme de contrôle IP et l’en-tête de liaison changent à chaque saut.',
    },
    'syn-server': {
        id: 'syn-server',
        title: 'Segment SYN — reçu par le serveur',
        protocol: 'TCP',
        size: '74 octets',
        where: 'Arrivée au serveur Web',
        beginner: {
            who: 'La box (c’est tout ce que voit le serveur).',
            to: 'Le serveur Web, port 443.',
            why: 'Pour ouvrir une connexion sécurisée.',
            next: 'Le serveur va répondre par un SYN-ACK.',
        },
        layers: [
            routerLink,
            ipv4({ src: NET.box.wanIp, dst: NET.server.ip, ttl: 60, protocol: 'TCP', totalLength: 60, changed: { ttl: true, checksum: true } }),
            synTcp(P.natted),
        ],
        note: 'TTL reçu : 60 = 64 − 4 routeurs (box, FAI, A, B).',
    },
    'synack-wan': {
        id: 'synack-wan',
        title: 'SYN-ACK — en route vers la box',
        protocol: 'TCP',
        size: '74 octets',
        where: 'Sur Internet, vers l’adresse publique de la box',
        beginner: {
            who: 'Le serveur Web.',
            to: 'L’adresse publique de la box.',
            why: 'Pour accepter la connexion.',
            next: 'La box va retrouver l’appareil concerné grâce à sa table NAT.',
        },
        layers: [
            routerLink,
            ipv4({ src: NET.server.ip, dst: NET.box.wanIp, ttl: 61, protocol: 'TCP', totalLength: 60 }),
            synAckTcp(P.natted),
        ],
    },
    'synack-lan': {
        id: 'synack-lan',
        title: 'SYN-ACK — après traduction inverse',
        protocol: 'TCP',
        size: '74 octets',
        where: 'Entre la box et l’ordinateur',
        beginner: {
            who: 'Le serveur Web.',
            to: 'Ton ordinateur (la box a rétabli son adresse).',
            why: 'Pour accepter la connexion.',
            next: 'L’ordinateur confirmera par un ACK : la connexion sera ouverte.',
        },
        layers: [
            ethernet({ src: NET.box.lanMac, dst: NET.pc.mac, srcLabel: 'box', dstLabel: 'ordinateur', type: '0x0800', changed: { src: true, dst: true } }),
            ipv4({ src: NET.server.ip, dst: NET.pc.ip, ttl: 60, protocol: 'TCP', totalLength: 60, changed: { dst: true, ttl: true, checksum: true } }),
            synAckTcp(P.client, true),
        ],
        note: 'Traduction inverse : IP et port de DESTINATION rétablis (203.0.113.25:62001 → 192.168.1.10:51514).',
    },
    'tcp-ack': {
        id: 'tcp-ack',
        title: 'ACK — la connexion est ouverte',
        protocol: 'TCP',
        size: '66 octets',
        where: 'Entre l’ordinateur et la box',
        beginner: {
            who: 'Ton ordinateur.',
            to: 'Le serveur Web.',
            why: 'Pour confirmer qu’il a bien reçu le SYN-ACK.',
            next: 'Les deux machines peuvent maintenant échanger des données.',
        },
        layers: [
            ethernet({ src: NET.pc.mac, dst: NET.box.lanMac, srcLabel: 'ordinateur', dstLabel: 'box', type: '0x0800' }),
            ipv4({ src: NET.pc.ip, dst: NET.server.ip, ttl: 64, protocol: 'TCP', totalLength: 52 }),
            tcp({ srcPort: P.client, dstPort: 443, seq: relSeq(1, NET.tcp.clientIsn + 1), ack: relSeq(1, NET.tcp.serverIsn + 1), flags: '0x010 (ACK)', window: 502, headerLength: 32, options: 'NOP, NOP, horodatage' }),
        ],
        note: 'La fenêtre 502 est multipliée par 2⁷ = 128 (facteur négocié) : environ 64 Kio.',
    },
    'client-hello': {
        id: 'client-hello',
        title: 'TLS ClientHello',
        protocol: 'TLSv1.3',
        size: '≈ 300 à 600 octets selon le navigateur',
        where: 'Entre l’ordinateur et la box (avant NAT)',
        beginner: {
            who: 'Le navigateur.',
            to: 'Le serveur Web.',
            why: 'Pour proposer une façon de chiffrer la conversation et indiquer le site voulu.',
            next: 'Le serveur choisit les paramètres et prouve son identité.',
        },
        layers: [
            ethernet({ src: NET.pc.mac, dst: NET.box.lanMac, srcLabel: 'ordinateur', dstLabel: 'box', type: '0x0800' }),
            ipv4({ src: NET.pc.ip, dst: NET.server.ip, ttl: 64, protocol: 'TCP', totalLength: 569 }),
            tcp({ srcPort: P.client, dstPort: 443, seq: relSeq(1, NET.tcp.clientIsn + 1), ack: relSeq(1, NET.tcp.serverIsn + 1), flags: '0x018 (PSH, ACK)', window: 502, headerLength: 32, options: 'NOP, NOP, horodatage' }),
            {
                name: 'TLS — Handshake',
                layer: 'security',
                fields: [
                    { name: 'Type', value: 'ClientHello', level: 2 },
                    { name: 'Nom du serveur (SNI)', value: NET.domain, level: 2, explain: 'Visible en clair : il permet au serveur de choisir le bon certificat. L’extension ECH, quand elle est utilisée, le chiffre.' },
                    { name: 'Versions proposées', value: 'TLS 1.3, TLS 1.2', level: 3, explain: 'Annoncées dans l’extension supported_versions ; le champ « version » historique indique 0x0303.' },
                    { name: 'ALPN', value: 'h2, http/1.1', level: 3, explain: 'Protocole applicatif souhaité au-dessus de TLS.' },
                    { name: 'Partage de clé', value: 'key_share (X25519)', level: 3, explain: 'Moitié publique d’un échange Diffie-Hellman éphémère.' },
                    { name: 'Suites de chiffrement', value: 'TLS_AES_128_GCM_SHA256, TLS_CHACHA20_POLY1305_SHA256…', level: 3 },
                ],
            },
        ],
    },
    'http-request': {
        id: 'http-request',
        title: 'Requête HTTP chiffrée (TLS Application Data)',
        protocol: 'TLSv1.3',
        size: 'variable',
        where: 'Sur Internet (après NAT)',
        beginner: {
            who: 'Le navigateur, via la box.',
            to: 'Le serveur Web.',
            why: 'Pour demander la page d’accueil.',
            next: 'Le serveur déchiffre la requête et prépare la réponse.',
        },
        layers: [
            routerLink,
            ipv4({ src: NET.box.wanIp, dst: NET.server.ip, ttl: 61, protocol: 'TCP', totalLength: 571 }),
            tcp({ srcPort: P.natted, dstPort: 443, seq: '518 (relatif)', ack: '3897 (relatif, illustratif)', flags: '0x018 (PSH, ACK)', window: 502, headerLength: 32 }),
            {
                name: 'TLS — Application Data',
                layer: 'security',
                fields: [
                    { name: 'Type d’enregistrement', value: 'Application Data (23)', level: 2 },
                    { name: 'Contenu', value: 'chiffré — illisible sur le trajet', level: 2 },
                    { name: 'Contenu après déchiffrement (serveur)', value: 'GET / HTTP/1.1 — Host: www.example.com', level: 3, explain: 'Seuls le navigateur et le serveur peuvent lire ces informations.' },
                ],
            },
        ],
        note: 'Une capture ordinaire montre seulement « Application Data » : la méthode, le chemin, les cookies et le contenu restent chiffrés.',
    },
    'http-response': {
        id: 'http-response',
        title: 'Réponse HTTP chiffrée — remise à l’ordinateur',
        protocol: 'TLSv1.3',
        size: 'jusqu’à 1514 octets par trame',
        where: 'Entre la box et l’ordinateur',
        beginner: {
            who: 'Le serveur Web.',
            to: 'Ton ordinateur.',
            why: 'Pour livrer le contenu de la page.',
            next: 'Le navigateur déchiffre et affiche la page.',
        },
        layers: [
            ethernet({ src: NET.box.lanMac, dst: NET.pc.mac, srcLabel: 'box', dstLabel: 'ordinateur', type: '0x0800' }),
            ipv4({ src: NET.server.ip, dst: NET.pc.ip, ttl: 60, protocol: 'TCP', totalLength: 1500, changed: { dst: true } }),
            tcp({ srcPort: 443, dstPort: P.client, seq: '3897 (relatif, illustratif)', ack: '1057 (relatif, illustratif)', flags: '0x010 (ACK)', window: 509, headerLength: 32, changed: { dstPort: true } }),
            {
                name: 'TLS — Application Data',
                layer: 'security',
                fields: [
                    { name: 'Contenu', value: 'chiffré', level: 2 },
                    { name: 'Après déchiffrement', value: 'HTTP/1.1 200 OK — Content-Type: text/html', level: 3 },
                ],
            },
        ],
        note: 'Taille du segment limitée par le MSS (1460 octets de données TCP pour une MTU Ethernet de 1500).',
    },
    'tcp-rst': {
        id: 'tcp-rst',
        title: 'RST, ACK — connexion refusée',
        protocol: 'TCP',
        size: '54 octets',
        where: 'Du serveur vers la box',
        beginner: {
            who: 'Le serveur.',
            to: 'La box (puis ton ordinateur).',
            why: 'Aucun programme n’attend de connexion sur ce port : le serveur refuse poliment.',
            next: 'Le navigateur affiche « connexion refusée ».',
        },
        layers: [
            routerLink,
            ipv4({ src: NET.server.ip, dst: NET.box.wanIp, ttl: 63, protocol: 'TCP', totalLength: 40 }),
            tcp({ srcPort: 443, dstPort: P.natted, seq: '1 (relatif)', ack: relSeq(1, NET.tcp.clientIsn + 1), flags: '0x014 (RST, ACK)', window: 0, headerLength: 20 }),
        ],
    },
    'dns-nxdomain': {
        id: 'dns-nxdomain',
        title: 'Réponse DNS : ce nom n’existe pas (NXDOMAIN)',
        protocol: 'DNS',
        size: '≈ 140 octets',
        where: 'Entre la box et l’ordinateur',
        beginner: {
            who: 'Le résolveur DNS.',
            to: 'Ton ordinateur.',
            why: 'Pour signaler qu’aucun site ne porte ce nom.',
            next: 'Sans adresse IP, le navigateur ne peut pas continuer.',
        },
        layers: [
            ethernet({ src: NET.box.lanMac, dst: NET.pc.mac, srcLabel: 'box', dstLabel: 'ordinateur', type: '0x0800' }),
            ipv4({ src: NET.resolver.ip, dst: NET.pc.ip, ttl: 60, protocol: 'UDP', totalLength: 126, df: false }),
            udp({ srcPort: 53, dstPort: P.dnsClient, length: 106 }),
            {
                name: 'DNS',
                layer: 'app',
                fields: [
                    { name: 'Question', value: 'wwww.example.com, type A', level: 2 },
                    { name: 'Code de réponse', value: '3 — NXDOMAIN (nom inexistant)', level: 2 },
                    { name: 'Drapeaux', value: '0x8183 (réponse, RD, RA, RCODE = 3)', level: 3 },
                    { name: 'Section autorité', value: 'enregistrement SOA de example.com (sert à mettre la réponse négative en cache)', level: 3 },
                ],
            },
        ],
    },
    'quic-initial': {
        id: 'quic-initial',
        title: 'QUIC Initial (contient le TLS ClientHello)',
        protocol: 'QUIC',
        size: '≥ 1200 octets (obligatoire)',
        where: 'Entre l’ordinateur et la box',
        beginner: {
            who: 'Le navigateur.',
            to: 'Le serveur Web, port 443 en UDP.',
            why: 'Pour ouvrir en une seule fois la connexion ET la négociation du chiffrement.',
            next: 'La box traduit l’adresse (NAT UDP), puis le paquet traverse Internet.',
        },
        layers: [
            ethernet({ src: NET.pc.mac, dst: NET.box.lanMac, srcLabel: 'ordinateur', dstLabel: 'box', type: '0x0800' }),
            ipv4({ src: NET.pc.ip, dst: NET.server.ip, ttl: 64, protocol: 'UDP', totalLength: 1228 }),
            udp({ srcPort: P.client, dstPort: 443, length: 1208 }),
            {
                name: 'QUIC',
                layer: 'transport',
                note: 'QUIC (RFC 9000) est un protocole de transport construit au-dessus d’UDP, avec TLS 1.3 intégré (RFC 9001).',
                fields: [
                    { name: 'Type de paquet', value: 'Initial (en-tête long)', level: 2 },
                    { name: 'Version', value: '0x00000001 (QUIC v1)', level: 3 },
                    { name: 'Connection ID destination', value: '8 octets aléatoires (illustratif)', level: 3, explain: 'Les identifiants de connexion permettent de suivre la connexion même si l’adresse ou le port changent (par exemple après un changement de mapping NAT).' },
                    { name: 'Trames', value: 'CRYPTO (TLS ClientHello, ALPN « h3 »), PADDING', level: 3, explain: 'Le datagramme est complété à 1200 octets minimum pour limiter les attaques par amplification.' },
                ],
            },
        ],
    },
};

// Variante « faute de frappe » de la requête DNS (même structure, autre nom).
packets['dns-query-typo'] = {
    ...packets['dns-query'],
    id: 'dns-query-typo',
    title: 'Requête DNS : adresse de wwww.example.com ?',
    size: '≈ 76 octets',
    beginner: { ...packets['dns-query'].beginner, why: 'Pour obtenir l’adresse IP du nom saisi… qui contient une faute de frappe.' },
    layers: packets['dns-query'].layers.map((layer) =>
        layer.name === 'DNS'
            ? { ...layer, fields: layer.fields.map((field) => (field.name === 'Question' ? { ...field, value: 'wwww.example.com, type A, classe IN' } : field)) }
            : layer,
    ),
};

/* ------------------------------------------------------------------ */
/* Briques d’étapes                                                     */
/* ------------------------------------------------------------------ */

const toServer = ['pc', 'box', 'isp', 'r1', 'r2', 'server'];
const fromServer = [...toServer].reverse();

const stepTyping: ScenarioStep = {
    id: 'saisie',
    title: 'Tu saisis une adresse Web',
    focus: ['pc'],
    packets: [],
    bubble: { node: 'pc', text: '🔒 https://www.example.com' },
    terms: ['url', 'nom-de-domaine', 'adresse-ip'],
    text: {
        1: "Tu tapes **www.example.com** dans le navigateur. Le navigateur veut afficher ce site, mais un ordinateur ne sait joindre une autre machine qu'avec son [[adresse-ip|adresse IP]], pas avec un nom.\n\nIl va donc d'abord chercher l'adresse IP de ce site.",
        2: "Le navigateur analyse l'[[url|URL]] `https://www.example.com` : le schéma `https` indique une connexion chiffrée vers le port **443** par défaut. Pour se connecter, il lui faut l'adresse IP qui correspond au [[nom-de-domaine|nom de domaine]] `www.example.com`.",
        3: "Analyse de l'URL : schéma `https`, hôte `www.example.com`, port implicite 443, chemin `/`. Le navigateur peut aussi tenir compte d'une politique HSTS ou d'un enregistrement DNS de type HTTPS (RFC 9460) annonçant HTTP/3.\n\nHypothèse de ce scénario : HTTPS sur TCP avec TLS 1.3 (la variante « HTTPS avec QUIC » montre l'autre possibilité).",
    },
};

const stepCacheMiss: ScenarioStep = {
    id: 'cache',
    title: 'Une réponse DNS est-elle déjà connue ?',
    focus: ['pc'],
    packets: [],
    bubble: { node: 'pc', text: 'Pas en cache : il faut demander', tone: 'warning' },
    terms: ['cache-dns', 'ttl'],
    table: {
        title: 'Cache DNS de l’ordinateur',
        caption: 'Noms résolus récemment, conservés pendant leur durée de validité.',
        columns: ['Nom', 'Type', 'Adresse', 'Expire dans'],
        rows: [
            ['cours.netlab.example', 'A', '192.0.2.80', '118 s'],
            ['www.example.com', '—', 'absent', '—'],
        ],
        highlight: 1,
        highlightKind: 'used',
    },
    text: {
        1: "Avant de demander à l'extérieur, l'ordinateur vérifie s'il connaît déjà la réponse : il garde en mémoire, dans un [[cache-dns|cache]], les noms récemment trouvés.\n\nIci, `www.example.com` n'y est pas : il faudra poser la question.",
        2: "Le navigateur et le système d'exploitation conservent les réponses DNS pendant une durée limitée, fixée par le [[ttl|TTL]] de chaque enregistrement. Aucune réponse utilisable n'est en cache : une requête DNS est nécessaire.",
        3: "Ordre de recherche typique : cache du navigateur, cache du système, fichier hosts (selon la configuration), puis requête au résolveur configuré. Une entrée expirée n'est plus utilisée.",
    },
};

const stepConfig: ScenarioStep = {
    id: 'configuration',
    title: 'L’ordinateur prépare l’envoi',
    focus: ['pc', 'box'],
    packets: [],
    terms: ['passerelle', 'sous-reseau', 'dhcp'],
    table: {
        title: 'Configuration réseau de l’ordinateur',
        caption: 'Reçue automatiquement de la box grâce à DHCP.',
        columns: ['Paramètre', 'Valeur'],
        rows: [
            ['Adresse IP', `${NET.pc.ip}`],
            ['Masque', '255.255.255.0 (/24)'],
            ['Passerelle par défaut', NET.box.lanIp],
            ['Serveur DNS', NET.resolver.ip],
        ],
        highlight: 2,
        highlightKind: 'used',
    },
    text: {
        1: "L'ordinateur connaît sa propre adresse (`192.168.1.10`) et sait que, pour joindre une machine hors de la maison, il doit tout confier à la box : c'est sa [[passerelle|passerelle]].",
        2: "Configuration reçue par [[dhcp|DHCP]] : adresse `192.168.1.10/24`, passerelle `192.168.1.1`, résolveur DNS `192.0.2.53`.\n\nAvec le masque /24, l'ordinateur calcule que le résolveur n'est **pas** dans son [[sous-reseau|sous-réseau]] : il enverra donc le paquet à la passerelle.",
        3: "Décision de routage de l'hôte : `192.0.2.53` n'appartient pas à `192.168.1.0/24` → route par défaut `0.0.0.0/0 via 192.168.1.1`.\n\nL'adresse IP de destination du paquet restera celle du résolveur ; seule l'adresse MAC de destination sera celle de la passerelle.",
    },
    simplification: 'Dans beaucoup de foyers, la box elle-même est déclarée comme serveur DNS et relaie les requêtes. Le principe reste le même.',
};

const stepArp: ScenarioStep = {
    id: 'arp',
    title: 'Trouver l’adresse MAC de la box (ARP)',
    focus: ['pc', 'box'],
    details: 'arp-request',
    terms: ['arp', 'adresse-mac', 'broadcast', 'table-arp'],
    packets: [
        { id: 'arp-req', label: 'ARP ?', tone: 'broadcast', path: ['pc', 'box'], hop: 1.3, inspect: 'arp-request' },
        { id: 'arp-rep', label: 'ARP ✓', tone: 'response', path: ['box', 'pc'], hop: 1.3, after: 'arp-req', inspect: 'arp-reply' },
    ],
    table: {
        title: 'Table ARP de l’ordinateur',
        caption: 'Correspondances « adresse IP → adresse MAC » du réseau local.',
        columns: ['Adresse IP', 'Adresse MAC', 'Type'],
        rows: [[NET.box.lanIp, NET.box.lanMac, 'dynamique']],
        highlight: 0,
        highlightKind: 'new',
    },
    text: {
        1: "Dans la maison, les messages voyagent dans des [[trame|trames]] qui utilisent l'[[adresse-mac|adresse MAC]], l'identifiant de la carte réseau.\n\nL'ordinateur demande donc à tout le réseau : « Qui a l'adresse 192.168.1.1 ? ». La box répond avec son adresse MAC.",
        2: "Protocole [[arp|ARP]] : la requête est envoyée en [[broadcast|diffusion]] (`ff:ff:ff:ff:ff:ff`), la réponse revient directement à l'ordinateur. Le résultat est mémorisé dans la [[table-arp|table ARP]] pour les envois suivants.",
        3: "ARP (RFC 826) n'existe qu'en IPv4 ; IPv6 utilise NDP (ICMPv6 Neighbor Solicitation / Neighbor Advertisement). La requête est encapsulée directement dans Ethernet (EtherType 0x0806) : elle n'est jamais routée.",
    },
    simplification: "Cette étape n'a lieu que si l'adresse MAC de la passerelle n'est pas déjà dans la table ARP.",
};

const stepDns: ScenarioStep = {
    id: 'dns',
    title: 'Demander l’adresse IP au résolveur DNS',
    focus: ['pc', 'box', 'isp', 'resolver'],
    details: 'dns-query',
    terms: ['dns', 'resolveur-dns', 'udp'],
    packets: [
        { id: 'dns-q', label: 'DNS ?', tone: 'request', path: ['pc', 'box', 'isp', 'resolver'], inspect: 'dns-query' },
        { id: 'dns-r', label: 'DNS ✓', tone: 'response', path: ['resolver', 'isp', 'box', 'pc'], after: 'dns-q', inspect: 'dns-response' },
    ],
    table: {
        title: 'Cache DNS de l’ordinateur',
        columns: ['Nom', 'Type', 'Adresse', 'Expire dans'],
        rows: [
            ['cours.netlab.example', 'A', '192.0.2.80', '104 s'],
            ['www.example.com', 'A', NET.server.ip, '300 s'],
        ],
        highlight: 1,
        highlightKind: 'new',
    },
    text: {
        1: "L'ordinateur envoie une petite question au [[resolveur-dns|résolveur DNS]] de son fournisseur d'accès : « Quelle est l'adresse IP de www.example.com ? ».\n\nLe résolveur répond : `198.51.100.20`.",
        2: "Requête [[dns|DNS]] de type **A** (adresse IPv4), transportée par [[udp|UDP]] vers le port **53**. La réponse contient l'adresse `198.51.100.20` et une durée de validité (300 s ici).\n\nCette requête traverse elle aussi la box et son [[nat|NAT]].",
        3: "En pratique, le client envoie souvent deux requêtes en parallèle : A (IPv4) et AAAA (IPv6). Réponse : QR = 1, RD = 1, RA = 1, RCODE = 0 (NOERROR).\n\nLe résolveur répond ici depuis son cache ; sinon, il effectue la résolution complète (variante « Résolution DNS complète »).",
    },
    simplification: 'Seule la requête A (IPv4) est montrée ; le résolveur connaît déjà la réponse.',
};

const natTable = (state: string, highlightKind: 'new' | 'used') => ({
    title: 'Table NAT de la box',
    caption: 'Chaque conversation sortante y est enregistrée pour pouvoir remettre les réponses au bon appareil.',
    columns: ['Proto', 'Adresse interne', 'Adresse publique', 'Destination', 'État'],
    rows: [
        ['UDP', `${NET.pc.ip}:${P.dnsClient}`, `${NET.box.wanIp}:${P.dnsNatted}`, `${NET.resolver.ip}:53`, 'réponse reçue'],
        ['TCP', pcSock, natSock, srvSock, state],
    ],
    highlight: 1,
    highlightKind,
});

const stepSynLan: ScenarioStep = {
    id: 'syn-lan',
    title: 'Le premier paquet part vers la box',
    focus: ['pc', 'box'],
    details: 'syn-lan',
    terms: ['tcp', 'port', 'adresse-privee', 'segment'],
    packets: [{ id: 'syn', label: 'SYN', tone: 'request', path: ['pc', 'box'], hop: 1.4, inspect: 'syn-lan' }],
    text: {
        1: "L'ordinateur connaît maintenant l'adresse du serveur. Il commence par envoyer un message appelé **SYN**, qui signifie : « Je voudrais ouvrir une conversation ».\n\nCe message part d'abord vers la box.",
        2: "Le navigateur ouvre une connexion [[tcp|TCP]] vers `198.51.100.20`, port **443** ([[https|HTTPS]]). Le système choisit un [[port|port source]] temporaire : `51514`.\n\nLe paquet porte l'[[adresse-privee|adresse IP privée]] `192.168.1.10` comme source ; la trame Ethernet, elle, est adressée à la MAC de la box.",
        3: "Segment SYN (numéro de séquence relatif 0) avec les options MSS 1460, SACK, horodatage et facteur d'échelle de fenêtre : trame de 74 octets.\n\nL'adresse IP de destination est celle du serveur mais l'adresse MAC de destination est celle de la passerelle : chaque couche a son propre destinataire.",
    },
};

const stepNat: ScenarioStep = {
    id: 'nat',
    title: 'La box traduit l’adresse (NAT/PAT)',
    focus: ['box'],
    details: 'syn-wan',
    terms: ['nat', 'pat', 'adresse-publique'],
    packets: [],
    bubble: { node: 'box', text: 'Traduction NAT/PAT', tone: 'warning' },
    transform: {
        title: 'Traduction d’adresse et de port',
        device: 'Box — sens sortant',
        before: [
            { label: 'IP source', value: NET.pc.ip },
            { label: 'Port source', value: String(P.client) },
            { label: 'IP destination', value: NET.server.ip },
            { label: 'Port destination', value: '443' },
        ],
        after: [
            { label: 'IP source', value: NET.box.wanIp },
            { label: 'Port source', value: String(P.natted) },
            { label: 'IP destination', value: NET.server.ip },
            { label: 'Port destination', value: '443' },
        ],
        caption: 'Seuls l’adresse IP source et le port source sont traduits. La destination reste identique.',
        disclaimer: 'Valeurs illustratives. Selon la box, le port source d’origine peut être conservé s’il est libre.',
    },
    table: natTable('SYN envoyé', 'new'),
    text: {
        1: "Une [[adresse-privee|adresse privée]] comme `192.168.1.10` n'est pas utilisable sur Internet.\n\nLa box remplace donc l'adresse de l'ordinateur par **sa propre adresse publique**, et note dans un carnet à qui appartient cette conversation.",
        2: "Traduction [[pat|NAT/PAT]] : IP source `192.168.1.10` → `203.0.113.25` (adresse publique de la box) et port source `51514` → `62001`.\n\nL'association est enregistrée dans la table NAT : c'est grâce à elle que la réponse pourra revenir vers le bon appareil.",
        3: "La box est aussi un routeur : elle décrémente le TTL (64 → 63) et recalcule les sommes de contrôle IP et TCP (le pseudo-en-tête TCP contient les adresses IP). L'adresse et le port de destination ne changent pas.\n\nLe NAT est un mécanisme (RFC 3022, RFC 4787), pas un protocole échangé entre machines.",
    },
};

const stepIsp: ScenarioStep = {
    id: 'fai',
    title: 'Dans le réseau du fournisseur d’accès',
    focus: ['box', 'isp'],
    details: 'syn-wan',
    terms: ['fai', 'table-de-routage'],
    packets: [{ id: 'syn-wan', label: 'SYN', tone: 'request', path: ['box', 'isp'], hop: 1.4, inspect: 'syn-wan' }],
    text: {
        1: "Le paquet quitte la maison par la ligne Internet (fibre, ADSL, 4G…) et arrive chez le **fournisseur d'accès** ([[fai|FAI]]). Son routeur est la porte d'entrée vers le reste d'Internet.",
        2: "Sur la ligne d'accès, l'en-tête de liaison n'est plus l'Ethernet de la maison : il dépend de la technologie (GPON pour la fibre, PPPoE, réseau mobile…). L'adresse IP source est désormais publique : `203.0.113.25`.",
        3: "Le routeur du FAI décrémente le TTL (63 → 62) et consulte sa [[table-de-routage|table de routage]]. Dans le cœur de réseau de l'opérateur, des étiquettes MPLS peuvent être ajoutées puis retirées sans que l'en-tête IP soit modifié.",
    },
};

const stepInternet: ScenarioStep = {
    id: 'internet',
    title: 'La traversée d’Internet',
    focus: ['isp', 'r1', 'r2'],
    details: 'syn-internet',
    terms: ['routage', 'table-de-routage', 'bgp', 'ttl'],
    packets: [{ id: 'syn-net', label: 'SYN', tone: 'request', path: ['isp', 'r1', 'r2'], hop: 1.2, inspect: 'syn-internet' }],
    table: {
        title: 'Extrait de la table de routage du routeur A',
        caption: 'La route la plus précise qui contient l’adresse de destination l’emporte.',
        columns: ['Destination', 'Prochain saut', 'Appris par'],
        rows: [
            ['198.51.100.0/24', 'Routeur B', 'BGP'],
            ['203.0.113.0/24', 'Routeur du FAI', 'BGP'],
            ['0.0.0.0/0', 'Opérateur de transit', 'statique'],
        ],
        highlight: 0,
        highlightKind: 'used',
    },
    text: {
        1: "Le paquet saute de routeur en routeur. Chaque [[routage|routeur]] regarde seulement l'adresse de destination et l'envoie vers le voisin qui le rapproche du serveur, comme un panneau indicateur à chaque carrefour.",
        2: "Chaque routeur consulte sa [[table-de-routage|table de routage]] : il cherche la route qui correspond le mieux à `198.51.100.20` (ici `198.51.100.0/24`) et transmet le paquet au **prochain saut**. Entre opérateurs, ces routes sont échangées grâce à [[bgp|BGP]].",
        3: "Règle du préfixe le plus long (longest prefix match). À chaque saut : [[ttl|TTL]] − 1, nouvel en-tête de liaison, somme de contrôle IPv4 recalculée. Après la box, les adresses IP et les ports restent identiques jusqu'au serveur.",
    },
    simplification: 'Le trajet réel compte souvent bien plus de routeurs et peut varier d’un paquet à l’autre.',
};

const stepServer: ScenarioStep = {
    id: 'serveur',
    title: 'Le serveur reçoit la demande',
    focus: ['server'],
    details: 'syn-server',
    terms: ['serveur', 'port'],
    packets: [{ id: 'syn-srv', label: 'SYN', tone: 'request', path: ['r2', 'server'], hop: 1.3, inspect: 'syn-server' }],
    bubble: { node: 'server', text: 'SYN reçu sur le port 443' },
    text: {
        1: "Le paquet arrive au serveur qui héberge le site. Le serveur vérifie qu'un programme (le serveur Web) attend bien des connexions sur ce port, puis accepte la demande.",
        2: "Le système du serveur trouve un service à l'écoute sur le port **443**. Il voit la demande venir de `203.0.113.25:62001` : il ne connaît pas l'adresse privée de l'ordinateur, seulement celle de la box.",
        3: "TTL reçu : 60 (64 − 4 routeurs). Le serveur crée un état de connexion (SYN-RECEIVED) et choisit son propre numéro de séquence initial.",
    },
};

const stepSynAck: ScenarioStep = {
    id: 'syn-ack',
    title: 'Le serveur répond : SYN-ACK',
    focus: ['server', 'r2', 'r1', 'isp', 'box'],
    details: 'synack-wan',
    terms: ['handshake'],
    packets: [{ id: 'synack', label: 'SYN-ACK', tone: 'response', path: ['server', 'r2', 'r1', 'isp', 'box'], inspect: 'synack-wan' }],
    text: {
        1: "Le serveur répond « D'accord, je suis prêt » avec un message **SYN-ACK**. La réponse est adressée à l'adresse publique de la box : c'est la seule qu'il connaisse.",
        2: "SYN-ACK : source `198.51.100.20:443`, destination `203.0.113.25:62001`. La réponse est routée comme n'importe quel paquet, selon son adresse de destination.",
        3: "Drapeaux SYN + ACK, séquence relative 0 (numéro initial du serveur), acquittement relatif 1 (numéro initial du client + 1). Le chemin retour peut différer de l'aller (routage asymétrique) : il est identique ici par simplicité.",
    },
};

const stepDeNat: ScenarioStep = {
    id: 'nat-retour',
    title: 'La box retrouve le bon destinataire',
    focus: ['box', 'pc'],
    details: 'synack-lan',
    terms: ['nat', 'port-forwarding'],
    packets: [{ id: 'synack-lan', label: 'SYN-ACK', tone: 'response', path: ['box', 'pc'], hop: 1.4, delay: 1.2, inspect: 'synack-lan' }],
    transform: {
        title: 'Traduction inverse',
        device: 'Box — sens entrant',
        before: [
            { label: 'IP source', value: NET.server.ip },
            { label: 'Port source', value: '443' },
            { label: 'IP destination', value: NET.box.wanIp },
            { label: 'Port destination', value: String(P.natted) },
        ],
        after: [
            { label: 'IP source', value: NET.server.ip },
            { label: 'Port source', value: '443' },
            { label: 'IP destination', value: NET.pc.ip },
            { label: 'Port destination', value: String(P.client) },
        ],
        caption: 'Au retour, ce sont l’adresse et le port de DESTINATION qui sont rétablis grâce à la table NAT.',
    },
    table: natTable('connexion établie', 'used'),
    text: {
        1: "La box consulte son carnet : la conversation « port 62001 » appartient à l'ordinateur `192.168.1.10`. Elle remet l'adresse et le port d'origine et transmet la réponse au bon appareil.",
        2: "Traduction inverse : destination `203.0.113.25:62001` → `192.168.1.10:51514`. Sans entrée correspondante dans la table NAT, la box ne saurait pas à quel appareil remettre ce paquet et le rejetterait.",
        3: "C'est pourquoi une connexion entrante non sollicitée échoue derrière un NAT, sauf règle de [[port-forwarding|redirection de port]]. La box décrémente aussi le TTL et réécrit l'en-tête Ethernet vers la MAC de l'ordinateur.",
    },
};

const stepTls: ScenarioStep = {
    id: 'tls',
    title: 'Connexion ouverte, puis négociation TLS',
    focus: toServer,
    details: 'client-hello',
    terms: ['tls', 'handshake', 'sni', 'certificat'],
    packets: [
        { id: 'ack', label: 'ACK', tone: 'control', path: toServer, hop: 0.5, inspect: 'tcp-ack' },
        { id: 'ch', label: 'ClientHello', tone: 'secure', path: toServer, hop: 0.6, after: 'ack', inspect: 'client-hello' },
        { id: 'sh', label: 'ServerHello…', tone: 'secure', path: fromServer, hop: 0.6, after: 'ch' },
        { id: 'fin', label: 'Finished', tone: 'secure', path: toServer, hop: 0.5, after: 'sh' },
    ],
    text: {
        1: "L'ordinateur confirme (**ACK**) : la connexion est ouverte.\n\nEnsuite, le navigateur et le serveur se mettent d'accord sur des clés secrètes pour **chiffrer** la conversation : c'est le rôle de [[tls|TLS]]. Le serveur prouve aussi son identité avec un [[certificat|certificat]].",
        2: "Fin de la [[handshake|poignée de main]] TCP (ACK), puis poignée de main TLS 1.3 : le **ClientHello** propose des algorithmes et indique le nom du site ([[sni|SNI]]) ; le serveur répond (ServerHello, certificat, preuve de possession de sa clé privée). Le navigateur vérifie le certificat avant de continuer.",
        3: "TLS 1.3 (RFC 8446) : un seul aller-retour. Le ClientHello contient un key_share (Diffie-Hellman éphémère) et le SNI en clair (sauf avec ECH). Après ServerHello, le reste des messages du serveur (EncryptedExtensions, Certificate, CertificateVerify, Finished) est déjà chiffré. Le protocole applicatif (HTTP/2 ou HTTP/1.1) est choisi par ALPN.",
    },
    simplification: 'Les messages TLS sont regroupés et les acquittements TCP intermédiaires ne sont pas montrés. Chaque paquet traverse la box et son NAT.',
};

const stepRequest: ScenarioStep = {
    id: 'requete',
    title: 'La requête HTTP, chiffrée',
    focus: ['pc', 'server'],
    details: 'http-request',
    terms: ['http', 'tls'],
    packets: [{ id: 'get', label: 'GET /', tone: 'secure', path: toServer, hop: 0.8, inspect: 'http-request' }],
    text: {
        1: "Le navigateur demande enfin la page : « Envoie-moi la page d'accueil ». Ce message est chiffré : sur le trajet, personne ne peut lire son contenu.",
        2: "Requête `GET / HTTP/1.1` avec l'en-tête `Host: www.example.com`, transportée dans des enregistrements TLS « Application Data ». Les équipements du trajet voient les adresses IP, les ports et la taille des paquets, mais pas l'URL complète ni le contenu.",
        3: "Visible sur le trajet : adresses, ports, tailles, horaires, SNI (sans ECH) et le nom demandé en DNS (sauf DNS chiffré : DoH, DoT). Chiffré : méthode, chemin, en-têtes HTTP, cookies et corps.",
    },
};

const stepResponse: ScenarioStep = {
    id: 'reponse',
    title: 'Le serveur renvoie la page',
    focus: fromServer,
    details: 'http-response',
    terms: ['segment', 'mss'],
    packets: [
        { id: 'data1', label: 'Données', tone: 'response', path: fromServer, hop: 0.8, inspect: 'http-response' },
        { id: 'data2', label: 'Données', tone: 'response', path: fromServer, hop: 0.8, delay: 1.1, inspect: 'http-response' },
    ],
    bubble: { node: 'box', text: 'Table NAT : 62001 → 192.168.1.10:51514', side: 'bottom' },
    text: {
        1: "Le serveur envoie la page, découpée en plusieurs paquets. À chaque passage, la box utilise son carnet NAT pour les remettre à l'ordinateur.",
        2: "Réponse `HTTP/1.1 200 OK` chiffrée, découpée en plusieurs [[segment|segments]] TCP. L'ordinateur accuse réception (ACK) ; TCP remet les données dans l'ordre et fait retransmettre ce qui manque.",
        3: "La taille des segments est limitée par le [[mss|MSS]] (1460 octets avec une MTU Ethernet de 1500). Le débit est régulé par la fenêtre de réception et le contrôle de congestion de l'émetteur.",
    },
};

const stepRender: ScenarioStep = {
    id: 'affichage',
    title: 'Le navigateur affiche la page',
    focus: ['pc'],
    packets: [],
    status: 'ok',
    bubble: { node: 'pc', text: 'Page affichée ✓', tone: 'ok' },
    terms: ['desencapsulation'],
    text: {
        1: "L'ordinateur rassemble les données, le navigateur les **déchiffre** et affiche la page.\n\nSouvent, la page demande d'autres fichiers (images, styles) : la même connexion peut être réutilisée.",
        2: "TLS déchiffre et vérifie l'intégrité de chaque enregistrement ; HTTP interprète la réponse (code 200, type de contenu) ; le navigateur analyse le HTML puis lance les requêtes complémentaires.",
        3: "Connexion maintenue (keep-alive) ou multiplexée avec HTTP/2. Fermeture par FIN/ACK ou après inactivité ; l'entrée NAT expire elle aussi après un délai sans trafic.",
    },
};

/* ------------------------------------------------------------------ */
/* Variantes                                                            */
/* ------------------------------------------------------------------ */

function scenario(id: string, title: string, summary: string, steps: ScenarioStep[], options: TopologyOptions = {}, extraAssumptions: string[] = []): Scenario {
    const { nodes, links, zones } = topology(options);
    return {
        id,
        title,
        summary,
        assumptions: [...assumptionsCommon, ...extraAssumptions],
        viewBox: { w: 1000, h: 500 },
        nodes,
        links,
        zones,
        packets,
        steps,
    };
}

const classic = scenario(
    'internet-tcp-tls',
    'Visite d’un site en HTTPS (TCP + TLS)',
    'Le parcours complet d’une requête Web, de la saisie de l’adresse à l’affichage de la page.',
    [stepTyping, stepCacheMiss, stepConfig, stepArp, stepDns, stepSynLan, stepNat, stepIsp, stepInternet, stepServer, stepSynAck, stepDeNat, stepTls, stepRequest, stepResponse, stepRender],
    {},
    ['HTTPS est transporté ici par TCP avec TLS 1.3 ; une autre possibilité, QUIC sur UDP, fait l’objet d’une variante.'],
);

const cached = scenario(
    'internet-dns-cache',
    'DNS déjà en cache',
    'L’adresse du site et celle de la box sont déjà connues : aucune requête DNS ni ARP n’est nécessaire.',
    [
        stepTyping,
        {
            ...stepCacheMiss,
            id: 'cache-hit',
            title: 'La réponse est déjà en cache',
            status: 'ok',
            bubble: { node: 'pc', text: 'Trouvé en cache ✓', tone: 'ok' },
            table: {
                title: 'Cache DNS de l’ordinateur',
                columns: ['Nom', 'Type', 'Adresse', 'Expire dans'],
                rows: [
                    ['cours.netlab.example', 'A', '192.0.2.80', '96 s'],
                    ['www.example.com', 'A', NET.server.ip, '212 s'],
                ],
                highlight: 1,
                highlightKind: 'used',
            },
            text: {
                1: "Tu as visité ce site il y a peu : l'ordinateur a gardé sa réponse en [[cache-dns|cache]]. Il connaît déjà l'adresse `198.51.100.20` : inutile de demander au résolveur.",
                2: "L'entrée DNS est encore valide (son [[ttl|TTL]] n'a pas expiré). Aucune requête DNS n'est émise : le gain de temps est d'un aller-retour vers le résolveur.",
                3: "Une réponse en cache peut être obsolète si l'adresse a changé avant l'expiration du TTL : c'est pourquoi les administrateurs réduisent le TTL avant une migration.",
            },
        },
        {
            ...stepConfig,
            id: 'configuration-cache',
            table: {
                title: 'Table ARP de l’ordinateur',
                caption: 'L’adresse MAC de la box est déjà connue : pas de requête ARP.',
                columns: ['Adresse IP', 'Adresse MAC', 'Type'],
                rows: [[NET.box.lanIp, NET.box.lanMac, 'dynamique']],
                highlight: 0,
                highlightKind: 'used',
            },
            text: {
                1: "L'ordinateur sait que le serveur est hors de la maison : il passera par la box, sa [[passerelle|passerelle]]. Il connaît déjà l'adresse MAC de la box (table ARP) : il peut envoyer directement.",
                2: "`198.51.100.20` n'appartient pas au [[sous-reseau|sous-réseau]] `192.168.1.0/24` → envoi à la passerelle `192.168.1.1`, dont l'adresse MAC est déjà dans la [[table-arp|table ARP]].",
            },
        },
        stepSynLan,
        stepNat,
        stepIsp,
        stepInternet,
        stepServer,
        stepSynAck,
        stepDeNat,
        stepTls,
        stepRequest,
        stepResponse,
        stepRender,
    ],
);

const resolutionSteps: ScenarioStep[] = [
    {
        id: 'dns-question',
        title: 'La question part vers le résolveur',
        focus: ['pc', 'resolver'],
        details: 'dns-query',
        terms: ['resolveur-dns', 'dns'],
        packets: [{ id: 'q', label: 'DNS ?', tone: 'request', path: ['pc', 'box', 'isp', 'resolver'], inspect: 'dns-query' }],
        bubble: { node: 'resolver', text: 'Pas en cache : je cherche', tone: 'warning' },
        text: {
            1: "L'ordinateur pose sa question au [[resolveur-dns|résolveur]]. Cette fois, le résolveur ne connaît pas la réponse : il va la chercher en interrogeant plusieurs serveurs, du plus général au plus précis.",
            2: "Requête récursive (RD = 1) : le client demande au résolveur de faire tout le travail. Le résolveur, lui, va effectuer des requêtes **itératives** auprès de la hiérarchie DNS.",
            3: "Le résolveur commence par les serveurs racine (connus grâce à un fichier « root hints ») ou, plus souvent, par les délégations déjà en cache (.com par exemple).",
        },
    },
    {
        id: 'dns-root-tld',
        title: 'Racine, puis serveur du « .com »',
        focus: ['resolver', 'root', 'tld'],
        terms: ['dns'],
        packets: [
            { id: 'root-q', label: '?', tone: 'request', path: ['resolver', 'root'], hop: 1.1 },
            { id: 'root-r', label: 'voir .com', tone: 'response', path: ['root', 'resolver'], hop: 1.1, after: 'root-q' },
            { id: 'tld-q', label: '?', tone: 'request', path: ['resolver', 'tld'], hop: 1.1, after: 'root-r' },
            { id: 'tld-r', label: 'voir example.com', tone: 'response', path: ['tld', 'resolver'], hop: 1.1, after: 'tld-q' },
        ],
        text: {
            1: "Le résolveur demande à un serveur **racine**, qui répond : « Je ne sais pas, mais voici les serveurs du .com ». Le serveur du **.com** répond à son tour : « Demande aux serveurs d'example.com ».",
            2: "Ces réponses sont des **délégations** : elles indiquent quel serveur est responsable de la partie suivante du nom. Le résolveur met chaque délégation en cache pour les prochaines fois.",
            3: "Réponses de type referral : enregistrements NS dans la section autorité et adresses des serveurs (glue) dans la section additionnelle. Avec la minimisation de requête (RFC 9156), le résolveur peut n'envoyer à la racine que « com » au lieu du nom complet.",
        },
        simplification: 'Ces échanges traversent eux aussi des routeurs d’Internet, non représentés.',
    },
    {
        id: 'dns-auth',
        title: 'Le serveur faisant autorité répond',
        focus: ['resolver', 'auth', 'pc'],
        details: 'dns-response',
        terms: ['cache-dns', 'ttl'],
        packets: [
            { id: 'auth-q', label: '?', tone: 'request', path: ['resolver', 'auth'], hop: 1.1 },
            { id: 'auth-r', label: 'A ✓', tone: 'response', path: ['auth', 'resolver'], hop: 1.1, after: 'auth-q' },
            { id: 'final', label: 'DNS ✓', tone: 'response', path: ['resolver', 'isp', 'box', 'pc'], after: 'auth-r', inspect: 'dns-response' },
        ],
        text: {
            1: "Le serveur officiel du domaine donne enfin la réponse : `198.51.100.20`. Le résolveur la transmet à l'ordinateur et la garde en mémoire pour les prochains visiteurs.",
            2: "Le serveur faisant autorité pour `example.com` renvoie l'enregistrement A. Le résolveur le met en cache pendant son [[ttl|TTL]] et répond au client.",
            3: "Réponse avec le drapeau AA (Authoritative Answer). Le résolveur peut valider la chaîne de signatures DNSSEC s'il est configuré pour cela. La réponse au client porte RA = 1 et AA = 0.",
        },
    },
];

const complete = scenario(
    'internet-dns-complete',
    'Résolution DNS complète',
    'Le résolveur ne connaît pas la réponse : il interroge la racine, le serveur du .com puis le serveur faisant autorité.',
    [stepTyping, stepCacheMiss, stepConfig, stepArp, ...resolutionSteps, stepSynLan, stepNat, stepIsp, stepInternet, stepServer, stepSynAck, stepDeNat, stepTls, stepRequest, stepResponse, stepRender],
    { dnsHierarchy: true },
    ['Les serveurs racine, .com et faisant autorité sont représentés de façon simplifiée ; leurs adresses ne sont pas indiquées.'],
);

const quicSteps: ScenarioStep[] = [
    {
        id: 'quic-initial',
        title: 'Un seul paquet pour ouvrir la connexion et le chiffrement',
        focus: ['pc', 'box'],
        details: 'quic-initial',
        terms: ['quic', 'udp', 'http-3'],
        packets: [{ id: 'init', label: 'QUIC Initial', tone: 'secure', path: ['pc', 'box'], hop: 1.4, inspect: 'quic-initial' }],
        text: {
            1: "Avec **HTTP/3**, le navigateur n'utilise pas TCP. Il envoie un premier paquet [[quic|QUIC]] qui, d'un coup, ouvre la connexion **et** commence la négociation du chiffrement.",
            2: "QUIC fonctionne au-dessus d'[[udp|UDP]], vers le port **443**. Le paquet « Initial » contient le ClientHello TLS 1.3. Il n'y a pas de SYN / SYN-ACK / ACK séparés : on gagne un aller-retour.",
            3: "Le datagramme qui porte le premier paquet Initial du client doit faire au moins 1200 octets (RFC 9000). Le navigateur apprend généralement qu'un site accepte HTTP/3 grâce à l'en-tête Alt-Svc ou à un enregistrement DNS HTTPS ; la première visite se fait souvent en TCP.",
        },
    },
    {
        id: 'quic-nat',
        title: 'La box traduit aussi le trafic UDP',
        focus: ['box'],
        details: 'quic-initial',
        terms: ['nat', 'pat'],
        packets: [],
        transform: {
            title: 'Traduction NAT/PAT d’un flux UDP',
            device: 'Box — sens sortant',
            before: [
                { label: 'IP source', value: NET.pc.ip },
                { label: 'Port source', value: String(P.client) },
                { label: 'IP destination', value: NET.server.ip },
                { label: 'Port destination', value: '443 (UDP)' },
            ],
            after: [
                { label: 'IP source', value: NET.box.wanIp },
                { label: 'Port source', value: String(P.natted) },
                { label: 'IP destination', value: NET.server.ip },
                { label: 'Port destination', value: '443 (UDP)' },
            ],
            caption: 'Le principe est le même qu’en TCP. Sans ouverture/fermeture visibles en UDP, la box supprime l’association après un délai d’inactivité.',
            disclaimer: 'Valeurs illustratives.',
        },
        text: {
            1: "Comme pour TCP, la box remplace l'adresse privée par son adresse publique et note la conversation dans sa table.",
            2: "Traduction [[pat|PAT]] du flux UDP : `192.168.1.10:51514` → `203.0.113.25:62001`. UDP n'a pas de SYN ni de FIN : la box garde l'entrée tant que du trafic circule, puis l'efface après un délai.",
            3: "Si la box change de port (expiration puis nouveau mapping), QUIC survit grâce aux identifiants de connexion (Connection ID) : c'est la migration de connexion, impossible en TCP.",
        },
    },
    {
        id: 'quic-internet',
        title: 'Traversée d’Internet jusqu’au serveur',
        focus: ['isp', 'r1', 'r2', 'server'],
        terms: ['routage'],
        packets: [{ id: 'init-net', label: 'QUIC Initial', tone: 'secure', path: ['box', 'isp', 'r1', 'r2', 'server'], hop: 0.9 }],
        text: {
            1: 'Le paquet traverse Internet exactement comme les autres : les routeurs ne regardent que l’adresse de destination.',
            2: 'Pour les routeurs, un datagramme UDP vers le port 443 est un paquet IP comme un autre. Certains réseaux d’entreprise bloquent UDP 443 : le navigateur revient alors à TCP + TLS.',
            3: "En-tête QUIC long en clair (version, Connection IDs) mais charge chiffrée ; même les paquets Initial sont protégés avec des clés dérivées publiquement de l'identifiant de connexion.",
        },
    },
    {
        id: 'quic-handshake',
        title: 'Le serveur répond et le chiffrement est établi',
        focus: toServer,
        terms: ['tls', 'certificat'],
        packets: [
            { id: 'srv-init', label: 'Initial + Handshake', tone: 'secure', path: fromServer, hop: 0.7 },
            { id: 'cli-fin', label: 'Handshake', tone: 'secure', path: toServer, hop: 0.6, after: 'srv-init' },
        ],
        text: {
            1: "Le serveur répond avec ses paramètres de chiffrement et son certificat. Dès que le navigateur a vérifié ce certificat, la conversation chiffrée peut commencer.",
            2: "Le serveur renvoie un paquet Initial (ServerHello) et des paquets Handshake (certificat, Finished). Le client termine avec son propre Finished. Au retour, la box applique la traduction inverse.",
            3: "Handshake QUIC + TLS 1.3 en 1 RTT (0-RTT possible en reprise de session, avec des précautions contre le rejeu).",
        },
    },
    {
        id: 'quic-request',
        title: 'Requête et réponse HTTP/3',
        focus: toServer,
        terms: ['http-3'],
        packets: [
            { id: 'h3-req', label: 'HTTP/3 GET', tone: 'secure', path: toServer, hop: 0.6 },
            { id: 'h3-res', label: 'Données', tone: 'response', path: fromServer, hop: 0.6, after: 'h3-req' },
        ],
        text: {
            1: "Le navigateur demande la page et le serveur la renvoie, toujours chiffrée.",
            2: "La requête HTTP/3 voyage dans des paquets QUIC « 1-RTT ». Chaque requête utilise son propre flux (stream) : la perte d'un paquet ne bloque pas les autres flux.",
            3: "Absence de blocage en tête de ligne au niveau transport, contrairement à HTTP/2 sur TCP. QUIC gère lui-même les retransmissions et le contrôle de congestion.",
        },
    },
    stepRender,
];

const quic = scenario(
    'internet-quic',
    'HTTPS avec QUIC (HTTP/3)',
    'La même visite, mais avec HTTP/3 : QUIC sur UDP remplace TCP et intègre TLS 1.3.',
    [stepTyping, stepCacheMiss, stepConfig, stepArp, stepDns, ...quicSteps],
    {},
    ['On suppose que le navigateur sait déjà que le site accepte HTTP/3.'],
);

const dnsError = scenario(
    'internet-dns-error',
    'Erreur DNS',
    'Une faute de frappe : le nom n’existe pas, la connexion ne peut pas commencer.',
    [
        { ...stepTyping, bubble: { node: 'pc', text: '🔒 https://wwww.example.com' }, text: { 1: "Tu tapes l'adresse… avec une faute de frappe : **wwww**.example.com (quatre « w »). Le navigateur ne le sait pas encore : il va chercher l'adresse IP de ce nom.", 2: "L'hôte demandé est `wwww.example.com`. Pour le navigateur, c'est un nom comme un autre : il faut le résoudre en adresse IP." } },
        {
            ...stepCacheMiss,
            table: { ...stepCacheMiss.table!, rows: [['cours.netlab.example', 'A', '192.0.2.80', '118 s'], ['wwww.example.com', '—', 'absent', '—']] },
        },
        stepConfig,
        stepArp,
        {
            id: 'dns-nx',
            title: 'Le résolveur répond : ce nom n’existe pas',
            focus: ['pc', 'resolver'],
            details: 'dns-nxdomain',
            status: 'error',
            terms: ['dns'],
            packets: [
                { id: 'q', label: 'DNS ?', tone: 'request', path: ['pc', 'box', 'isp', 'resolver'], inspect: 'dns-query-typo' },
                { id: 'nx', label: 'NXDOMAIN', tone: 'error', path: ['resolver', 'isp', 'box', 'pc'], after: 'q', inspect: 'dns-nxdomain' },
            ],
            text: {
                1: 'Le résolveur cherche, puis répond : « Ce nom n’existe pas ». Sans adresse IP, impossible de contacter un serveur.',
                2: 'Réponse DNS avec le code **NXDOMAIN** (nom inexistant). Aucune adresse n’est fournie ; la réponse négative peut elle-même être mise en cache.',
                3: 'RCODE = 3. À distinguer de SERVFAIL (le résolveur n’a pas pu obtenir de réponse, par exemple serveur faisant autorité injoignable ou échec DNSSEC) et d’une absence totale de réponse (délai expiré).',
            },
        },
        {
            id: 'dns-error-page',
            title: 'Le navigateur affiche une erreur',
            focus: ['pc'],
            packets: [],
            status: 'error',
            bubble: { node: 'pc', text: 'Ce site est inaccessible : adresse introuvable', tone: 'error' },
            text: {
                1: "Le navigateur affiche un message d'erreur : il n'a trouvé aucune adresse pour ce nom. Aucun paquet n'a été envoyé au serveur.",
                2: "Indice de diagnostic : le problème se situe **avant** la connexion. Vérifie l'orthographe, puis teste la résolution avec `nslookup` ou `dig`.",
                3: "Les navigateurs affichent un code du type « DNS_PROBE_FINISHED_NXDOMAIN ». Si `nslookup` réussit avec un autre résolveur, le problème vient du résolveur configuré.",
            },
        },
    ],
);

const gatewayDown = scenario(
    'internet-gateway-down',
    'Passerelle inaccessible',
    'La box est éteinte ou le câble est débranché : l’ordinateur ne peut même pas sortir de la maison.',
    [
        stepTyping,
        stepCacheMiss,
        stepConfig,
        {
            id: 'arp-fail',
            title: 'Personne ne répond à la requête ARP',
            focus: ['pc', 'box'],
            details: 'arp-request',
            status: 'error',
            terms: ['arp', 'passerelle'],
            bubble: { node: 'box', text: 'Box éteinte', tone: 'error', side: 'bottom' },
            packets: [
                { id: 'arp1', label: 'ARP ?', tone: 'broadcast', path: ['pc', 'box'], hop: 1.2, lost: true, inspect: 'arp-request' },
                { id: 'arp2', label: 'ARP ?', tone: 'broadcast', path: ['pc', 'box'], hop: 1.2, lost: true, after: 'arp1', delay: 0.4, inspect: 'arp-request' },
                { id: 'arp3', label: 'ARP ?', tone: 'broadcast', path: ['pc', 'box'], hop: 1.2, lost: true, after: 'arp2', delay: 0.4, inspect: 'arp-request' },
            ],
            text: {
                1: "L'ordinateur demande « Qui a 192.168.1.1 ? »… mais la box ne répond pas. Il réessaie plusieurs fois, sans succès.",
                2: "Sans réponse [[arp|ARP]], l'ordinateur ne connaît pas l'adresse MAC de la [[passerelle|passerelle]] : il ne peut envoyer **aucun** paquet hors du réseau local, pas même la requête DNS.",
                3: "Le système abandonne après quelques tentatives ; un `ping 192.168.1.1` affiche alors « Impossible de joindre l'hôte de destination » (généré localement par l'ordinateur).",
            },
        },
        {
            id: 'gateway-error',
            title: 'Pas d’accès à Internet',
            focus: ['pc'],
            packets: [],
            status: 'error',
            bubble: { node: 'pc', text: 'Aucune connexion Internet', tone: 'error' },
            text: {
                1: "Le navigateur indique qu'il n'y a pas de connexion. Le problème est tout près : la box ou le câble.",
                2: "Méthode de diagnostic : vérifier la liaison (voyants, câble, Wi-Fi), puis `ping 192.168.1.1`. Si la passerelle ne répond pas, inutile de chercher plus loin.",
                3: "Une table ARP sans entrée pour la passerelle (`arp -a`) confirme l'échec de résolution. Avec une adresse en 169.254.x.x, c'est le DHCP qui a échoué (adresse autoconfigurée).",
            },
        },
    ],
    { boxDown: true },
);

const portBlocked = scenario(
    'internet-port-blocked',
    'Port bloqué par un pare-feu',
    'Le SYN est détruit silencieusement par un pare-feu : l’ordinateur réessaie puis abandonne.',
    [
        stepTyping,
        stepCacheMiss,
        stepConfig,
        stepArp,
        stepDns,
        stepSynLan,
        stepNat,
        stepIsp,
        {
            id: 'blocked',
            title: 'Le pare-feu détruit le paquet',
            focus: ['r1', 'r2', 'fw'],
            status: 'error',
            details: 'syn-internet',
            terms: ['pare-feu'],
            packets: [{ id: 'syn-drop', label: 'SYN', tone: 'request', path: ['isp', 'r1', 'r2', 'fw'], hop: 1, lost: true, inspect: 'syn-internet' }],
            bubble: { node: 'fw', text: 'Règle : bloquer → paquet détruit', tone: 'error', side: 'bottom' },
            text: {
                1: "Devant le serveur, un [[pare-feu|pare-feu]] applique une règle qui bloque ce trafic. Il jette le paquet **sans rien répondre**.",
                2: 'Action « DROP » : aucune réponse n’est renvoyée. Pour l’ordinateur, c’est comme si le paquet s’était perdu.',
                3: "Avec « REJECT », le pare-feu renverrait un TCP RST ou un ICMP « destination injoignable » : l'échec serait immédiat et plus facile à diagnostiquer.",
            },
        },
        {
            id: 'retransmissions',
            title: 'L’ordinateur réessaie',
            focus: ['pc', 'fw'],
            status: 'warning',
            terms: ['retransmission-tcp'],
            packets: [
                { id: 'syn-r1', label: 'SYN (2ᵉ)', tone: 'request', path: ['pc', 'box', 'isp', 'r1', 'r2', 'fw'], hop: 0.5, lost: true, inspect: 'syn-lan' },
                { id: 'syn-r2', label: 'SYN (3ᵉ)', tone: 'request', path: ['pc', 'box', 'isp', 'r1', 'r2', 'fw'], hop: 0.5, lost: true, after: 'syn-r1', delay: 0.8, inspect: 'syn-lan' },
            ],
            text: {
                1: "Ne recevant pas de réponse, l'ordinateur renvoie son SYN, en attendant de plus en plus longtemps entre chaque essai.",
                2: "[[retransmission-tcp|Retransmissions]] du SYN avec un délai qui double à chaque fois (environ 1 s, 2 s, 4 s…). Dans Wireshark, elles apparaissent comme « TCP Retransmission ».",
                3: "Sous Linux, le nombre d'essais dépend du paramètre `tcp_syn_retries` (6 par défaut, soit environ deux minutes). Les navigateurs abandonnent souvent plus tôt.",
            },
        },
        {
            id: 'timeout',
            title: 'Délai dépassé',
            focus: ['pc'],
            status: 'error',
            packets: [],
            bubble: { node: 'pc', text: 'Le délai de connexion a expiré', tone: 'error' },
            text: {
                1: "Après plusieurs essais, le navigateur abandonne et affiche « délai de connexion expiré ». Le nom a bien été trouvé : le blocage est plus loin.",
                2: 'Diagnostic : DNS OK, passerelle OK, mais aucune réponse au SYN → filtrage probable sur le chemin ou devant le serveur. Tester un autre port ou un autre réseau aide à localiser le blocage.',
                3: 'Symptôme typique « filtered » (pas de réponse), à différencier de « refused » (RST reçu). La commande `Test-NetConnection -Port 443` ou `nc -vz` permet de le vérifier.',
            },
        },
    ],
    { firewall: true },
    ['Le pare-feu applique volontairement une règle « DROP » sur le port 443 pour les besoins du scénario.'],
);

const refused = scenario(
    'internet-refused',
    'Échec de connexion au serveur',
    'Le serveur est joignable, mais aucun service n’écoute sur le port : il refuse avec un RST.',
    [
        stepTyping,
        stepCacheMiss,
        stepConfig,
        stepArp,
        stepDns,
        stepSynLan,
        stepNat,
        stepIsp,
        stepInternet,
        {
            ...stepServer,
            id: 'serveur-ferme',
            title: 'Aucun service n’écoute sur le port 443',
            status: 'warning',
            bubble: { node: 'server', text: 'Port 443 fermé', tone: 'warning' },
            text: {
                1: "Le paquet arrive au serveur, mais le programme du site Web est arrêté : personne n'attend de connexion sur ce port.",
                2: "Le système du serveur ne trouve aucun programme à l'écoute sur le port **443** (service arrêté ou mal configuré).",
                3: 'Pour un port TCP fermé, la RFC 9293 prévoit de répondre par un segment RST.',
            },
        },
        {
            id: 'rst',
            title: 'Le serveur refuse : RST',
            focus: fromServer,
            status: 'error',
            details: 'tcp-rst',
            terms: ['tcp'],
            packets: [{ id: 'rst', label: 'RST', tone: 'error', path: fromServer, hop: 0.8, inspect: 'tcp-rst' }],
            bubble: { node: 'pc', text: 'Connexion refusée', tone: 'error' },
            text: {
                1: "Le serveur répond aussitôt : « Connexion refusée ». La box transmet ce refus à l'ordinateur, et le navigateur affiche une erreur.",
                2: "Segment **RST, ACK** : la connexion est immédiatement abandonnée. Contrairement au pare-feu silencieux, l'échec est instantané.",
                3: "Indice de diagnostic : DNS, routage et NAT fonctionnent (un paquet est revenu !) ; le problème est côté service. Wireshark affiche ce segment en rouge avec les drapeaux [RST, ACK].",
            },
        },
    ],
);

export const internetVariants: ScenarioVariant[] = [
    { id: 'tcp-tls', label: 'HTTPS (TCP + TLS)', description: classic.summary, scenario: classic },
    { id: 'dns-cache', label: 'DNS déjà en cache', description: cached.summary, scenario: cached },
    { id: 'dns-complet', label: 'Résolution DNS complète', description: complete.summary, scenario: complete },
    { id: 'quic', label: 'HTTPS avec QUIC', description: quic.summary, scenario: quic },
    { id: 'erreur-dns', label: 'Erreur DNS', description: dnsError.summary, scenario: dnsError, status: 'error' },
    { id: 'passerelle', label: 'Passerelle inaccessible', description: gatewayDown.summary, scenario: gatewayDown, status: 'error' },
    { id: 'port-bloque', label: 'Port bloqué', description: portBlocked.summary, scenario: portBlocked, status: 'error' },
    { id: 'echec-serveur', label: 'Échec de connexion', description: refused.summary, scenario: refused, status: 'error' },
];
