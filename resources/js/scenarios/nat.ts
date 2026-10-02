import type { Scenario, ScenarioVariant } from '@/engine/types';
import { assumptionsCommon, NET } from './addressing';
import { ethernet, ipv4, relSeq, tcp } from './builders';

const P = NET.ports;

const natRows = (count: 1 | 2) =>
    [
        ['TCP', `${NET.pc.ip}:${P.client}`, `${NET.box.wanIp}:${P.natted}`, `${NET.server.ip}:443`],
        ['TCP', `${NET.phone.ip}:${P.phoneClient}`, `${NET.box.wanIp}:${P.phoneNatted}`, `${NET.server.ip}:443`],
    ].slice(0, count);

const natTable = (count: 1 | 2, highlight: number, kind: 'new' | 'used') => ({
    title: 'Table NAT de la box',
    caption: 'Une ligne par conversation : c’est la mémoire qui permet de remettre les réponses au bon appareil.',
    columns: ['Proto', 'Adresse interne', 'Adresse publique', 'Destination'],
    rows: natRows(count),
    highlight,
    highlightKind: kind,
});

const syn = (srcIp: string, srcPort: number, ttl: number, natted: boolean) => [
    natted
        ? { name: "Liaison d'accès", layer: 'link' as const, fields: [{ name: 'Technologie', value: 'selon l’abonnement (fibre, DSL, 4G…)', level: 2 as const }] }
        : ethernet({ src: srcIp === NET.pc.ip ? NET.pc.mac : NET.phone.mac, dst: NET.box.lanMac, srcLabel: srcIp === NET.pc.ip ? 'ordinateur' : 'téléphone', dstLabel: 'box', type: '0x0800' }),
    ipv4({ src: srcIp, dst: NET.server.ip, ttl, protocol: 'TCP', totalLength: 60, changed: natted ? { src: true, ttl: true, checksum: true } : undefined }),
    tcp({ srcPort, dstPort: 443, seq: relSeq(0, NET.tcp.clientIsn), ack: '0', flags: '0x002 (SYN)', window: 64240, headerLength: 40, changed: natted ? { srcPort: true, checksum: true } : undefined }),
];

export const natScenario: Scenario = {
    id: 'nat-pat',
    title: 'Plusieurs appareils, une seule adresse publique',
    summary: 'L’ordinateur et le téléphone visitent le même site en même temps : la box les distingue grâce aux ports.',
    assumptions: [
        ...assumptionsCommon,
        'Les deux appareils choisissent volontairement le même port source (51514) pour montrer que la box sait les distinguer.',
        'Les ports publics 62001 et 62002 sont illustratifs : chaque équipement NAT a sa propre stratégie d’attribution.',
    ],
    viewBox: { w: 1000, h: 520 },
    zones: [
        { id: 'home', label: 'Maison — réseau privé', x: 20, y: 40, w: 390, h: 450, tone: 'home' },
        { id: 'internet', label: 'Internet — adresses publiques', x: 430, y: 40, w: 550, h: 450, tone: 'internet' },
    ],
    nodes: [
        { id: 'pc', kind: 'laptop', label: 'Ordinateur', sublabel: NET.pc.ip, x: 100, y: 150, term: 'adresse-privee', description: { 1: 'Ton ordinateur, avec une adresse privée.', 2: 'Adresse privée 192.168.1.10, invisible depuis Internet.' } },
        { id: 'phone', kind: 'phone', label: 'Téléphone', sublabel: NET.phone.ip, x: 100, y: 380, term: 'adresse-privee', description: { 1: 'Ton téléphone, connecté au même réseau Wi-Fi.', 2: 'Adresse privée 192.168.1.23 attribuée par la box (DHCP).' } },
        {
            id: 'box',
            kind: 'box',
            label: 'Box',
            sublabel: `${NET.box.lanIp}\n${NET.box.wanIp}`,
            x: 320,
            y: 265,
            term: 'nat',
            description: {
                1: 'La box est la seule à posséder une adresse publique. Elle la prête à tous les appareils de la maison.',
                2: 'Elle réalise la traduction NAT/PAT et tient une table des conversations en cours.',
                3: 'Fonction « NAPT » : chaque flux sortant reçoit un couple (IP publique, port) unique. Les entrées expirent après inactivité.',
            },
            facts: [{ label: 'Adresse publique', value: NET.box.wanIp }, { label: 'Adresse locale', value: NET.box.lanIp }],
        },
        { id: 'net', kind: 'cloud', label: 'Internet', sublabel: 'routeurs', x: 590, y: 265, term: 'routage', description: { 1: 'Le réseau des réseaux : de nombreux routeurs, simplifiés ici en un nuage.' } },
        { id: 'server', kind: 'server', label: 'Serveur Web', sublabel: NET.server.ip, x: 880, y: 160, term: 'serveur', description: { 1: 'Le site visité par les deux appareils.', 2: 'Il ne voit que l’adresse publique de la box, avec deux ports différents.' } },
        { id: 'other', kind: 'desktop', label: 'Machine inconnue', sublabel: '192.0.2.99', x: 880, y: 400, description: { 1: 'Une machine quelconque d’Internet qui tente de joindre la box sans y avoir été invitée.' } },
    ],
    links: [
        { from: 'pc', to: 'box', medium: 'ethernet' },
        { from: 'phone', to: 'box', medium: 'wifi' },
        { from: 'box', to: 'net', medium: 'fiber' },
        { from: 'net', to: 'server', medium: 'wan' },
        { from: 'net', to: 'other', medium: 'wan' },
    ],
    packets: {
        'pc-syn-lan': {
            id: 'pc-syn-lan',
            title: 'SYN de l’ordinateur — dans la maison',
            protocol: 'TCP',
            size: '74 octets',
            where: 'Entre l’ordinateur et la box',
            beginner: { who: 'L’ordinateur.', to: 'Le serveur Web.', why: 'Pour ouvrir une connexion.', next: 'La box va traduire l’adresse et le port source.' },
            layers: syn(NET.pc.ip, P.client, 64, false),
        },
        'pc-syn-wan': {
            id: 'pc-syn-wan',
            title: 'SYN de l’ordinateur — après traduction',
            protocol: 'TCP',
            where: 'Sur Internet',
            beginner: { who: 'La box, au nom de l’ordinateur.', to: 'Le serveur Web.', why: 'L’adresse privée a été remplacée par l’adresse publique.', next: 'Le serveur répondra au port 62001.' },
            layers: syn(NET.box.wanIp, P.natted, 63, true),
        },
        'phone-syn-lan': {
            id: 'phone-syn-lan',
            title: 'SYN du téléphone — dans la maison',
            protocol: 'TCP',
            size: '74 octets',
            where: 'Entre le téléphone et la box',
            beginner: { who: 'Le téléphone.', to: 'Le même serveur Web.', why: 'Pour ouvrir sa propre connexion.', next: 'La box doit lui attribuer un autre port public.' },
            layers: syn(NET.phone.ip, P.phoneClient, 64, false),
            note: 'Même port source (51514) que l’ordinateur : seule l’adresse IP privée diffère.',
        },
        'phone-syn-wan': {
            id: 'phone-syn-wan',
            title: 'SYN du téléphone — après traduction',
            protocol: 'TCP',
            where: 'Sur Internet',
            beginner: { who: 'La box, au nom du téléphone.', to: 'Le serveur Web.', why: 'Même adresse publique, mais port 62002.', next: 'Le serveur voit deux connexions distinctes.' },
            layers: syn(NET.box.wanIp, P.phoneNatted, 63, true),
        },
    },
    steps: [
        {
            id: 'intro',
            title: 'Deux appareils, une seule adresse publique',
            focus: ['pc', 'phone', 'box'],
            packets: [],
            terms: ['adresse-privee', 'adresse-publique', 'nat'],
            table: { title: 'Table NAT de la box', caption: 'Vide pour l’instant : aucune conversation en cours.', columns: ['Proto', 'Adresse interne', 'Adresse publique', 'Destination'], rows: [] },
            text: {
                1: "Dans la maison, chaque appareil a sa propre [[adresse-privee|adresse privée]]. Mais vers Internet, la box ne possède qu'**une seule** [[adresse-publique|adresse publique]] : `203.0.113.25`.\n\nComment deux appareils peuvent-ils visiter le même site en même temps ?",
                2: "Les adresses `192.168.1.10` et `192.168.1.23` ne sont pas routables sur Internet. La box va utiliser le [[pat|PAT]] : elle traduit l'adresse ET le port source de chaque conversation.",
                3: "C'est la configuration la plus répandue en IPv4. En IPv6, chaque appareil dispose généralement d'une adresse globale et la traduction n'est pas nécessaire ; un pare-feu à états assure le filtrage.",
            },
        },
        {
            id: 'pc-out',
            title: 'L’ordinateur ouvre une connexion',
            focus: ['pc', 'box'],
            details: 'pc-syn-lan',
            packets: [{ id: 'syn-pc', label: 'SYN', tone: 'request', path: ['pc', 'box'], hop: 1.3, inspect: 'pc-syn-lan' }],
            text: {
                1: "L'ordinateur envoie une demande de connexion au site. Le message porte son adresse privée et un numéro de port choisi au hasard : `51514`.",
                2: "Segment SYN : `192.168.1.10:51514 → 198.51.100.20:443`. Le port source sert à reconnaître la conversation au retour.",
            },
        },
        {
            id: 'pc-nat',
            title: 'La box traduit et note la conversation',
            focus: ['box', 'net', 'server'],
            details: 'pc-syn-wan',
            packets: [{ id: 'syn-pc-wan', label: 'SYN', tone: 'request', path: ['box', 'net', 'server'], delay: 1.2, inspect: 'pc-syn-wan' }],
            transform: {
                title: 'Traduction sortante — ordinateur',
                device: 'Box',
                before: [
                    { label: 'IP source', value: NET.pc.ip },
                    { label: 'Port source', value: String(P.client) },
                    { label: 'Destination', value: `${NET.server.ip}:443` },
                ],
                after: [
                    { label: 'IP source', value: NET.box.wanIp },
                    { label: 'Port source', value: String(P.natted) },
                    { label: 'Destination', value: `${NET.server.ip}:443` },
                ],
                caption: 'La destination ne change pas. L’association est enregistrée dans la table.',
                disclaimer: 'Valeurs illustratives.',
            },
            table: natTable(1, 0, 'new'),
            text: {
                1: "La box remplace l'adresse de l'ordinateur par la sienne et choisit un port public : `62001`. Elle note dans sa table : « 62001, c'est l'ordinateur ».",
                2: "Traduction : `192.168.1.10:51514` → `203.0.113.25:62001`. Les sommes de contrôle IP et TCP sont recalculées.",
                3: "Selon la RFC 4787, un NAT « bien élevé » réutilise le même mapping externe pour un même couple interne (mapping indépendant de la destination), ce qui facilite les applications pair-à-pair.",
            },
        },
        {
            id: 'phone-out',
            title: 'Le téléphone ouvre aussi une connexion',
            focus: ['phone', 'box'],
            details: 'phone-syn-lan',
            packets: [{ id: 'syn-phone', label: 'SYN', tone: 'request', path: ['phone', 'box'], hop: 1.3, inspect: 'phone-syn-lan' }],
            bubble: { node: 'phone', text: 'Port source : 51514 (le même !)', tone: 'warning', side: 'bottom' },
            text: {
                1: "Au même moment, le téléphone visite le même site. Par hasard, il choisit lui aussi le port `51514`.",
                2: "`192.168.1.23:51514 → 198.51.100.20:443`. Si la box se contentait de remplacer l'adresse IP, les deux conversations deviendraient identiques vues d'Internet.",
            },
        },
        {
            id: 'phone-nat',
            title: 'Un autre port public pour le téléphone',
            focus: ['box', 'net', 'server'],
            details: 'phone-syn-wan',
            packets: [{ id: 'syn-phone-wan', label: 'SYN', tone: 'request', path: ['box', 'net', 'server'], delay: 1.2, inspect: 'phone-syn-wan' }],
            transform: {
                title: 'Traduction sortante — téléphone',
                device: 'Box',
                before: [
                    { label: 'IP source', value: NET.phone.ip },
                    { label: 'Port source', value: String(P.phoneClient) },
                    { label: 'Destination', value: `${NET.server.ip}:443` },
                ],
                after: [
                    { label: 'IP source', value: NET.box.wanIp },
                    { label: 'Port source', value: String(P.phoneNatted) },
                    { label: 'Destination', value: `${NET.server.ip}:443` },
                ],
                caption: 'Le port public 62001 est déjà pris : la box en attribue un autre.',
            },
            table: natTable(2, 1, 'new'),
            text: {
                1: "La box voit que le port `62001` est déjà utilisé. Elle attribue donc `62002` au téléphone et ajoute une deuxième ligne à sa table.",
                2: "C'est le cœur du [[pat|PAT]] : un couple (adresse publique, port) unique par conversation.",
            },
        },
        {
            id: 'server-view',
            title: 'Ce que voit le serveur',
            focus: ['server'],
            packets: [],
            bubble: { node: 'server', text: '2 connexions de 203.0.113.25 : ports 62001 et 62002', side: 'bottom' },
            table: {
                title: 'Connexions vues par le serveur',
                columns: ['Client', 'Port local'],
                rows: [
                    [`${NET.box.wanIp}:${P.natted}`, '443'],
                    [`${NET.box.wanIp}:${P.phoneNatted}`, '443'],
                ],
            },
            text: {
                1: "Le serveur voit deux connexions venant de la **même** adresse, avec deux ports différents. Il ne sait pas qu'il y a un ordinateur et un téléphone derrière la box.",
                2: "Pour le serveur, une connexion est identifiée par le quadruplet (IP client, port client, IP serveur, port serveur) : les ports suffisent à les distinguer.",
                3: "C'est aussi pourquoi bloquer une adresse IP publique peut bloquer tout un foyer, voire des milliers d'abonnés derrière un CGNAT.",
            },
        },
        {
            id: 'reply',
            title: 'La réponse retrouve le bon appareil',
            focus: ['server', 'box', 'phone'],
            packets: [
                { id: 'ack-phone', label: 'SYN-ACK → 62002', tone: 'response', path: ['server', 'net', 'box'], hop: 0.9 },
                { id: 'ack-phone-lan', label: 'SYN-ACK', tone: 'response', path: ['box', 'phone'], hop: 1.2, after: 'ack-phone' },
            ],
            transform: {
                title: 'Traduction inverse',
                device: 'Box',
                before: [
                    { label: 'IP destination', value: NET.box.wanIp },
                    { label: 'Port destination', value: String(P.phoneNatted) },
                ],
                after: [
                    { label: 'IP destination', value: NET.phone.ip },
                    { label: 'Port destination', value: String(P.phoneClient) },
                ],
                caption: 'La ligne « 62002 » de la table désigne le téléphone.',
            },
            table: natTable(2, 1, 'used'),
            text: {
                1: "Le serveur répond au port `62002`. La box consulte sa table : `62002`, c'est le téléphone. Elle remet l'adresse et le port d'origine et lui transmet la réponse.",
                2: "Traduction inverse : `203.0.113.25:62002` → `192.168.1.23:51514`. L'ordinateur, lui, ne reçoit pas ce paquet.",
            },
        },
        {
            id: 'unsolicited',
            title: 'Une connexion non sollicitée est bloquée',
            focus: ['other', 'box'],
            status: 'warning',
            packets: [{ id: 'intrusion', label: 'SYN → :8080', tone: 'error', path: ['other', 'net', 'box'], hop: 1, lost: true }],
            bubble: { node: 'box', text: 'Aucune entrée pour le port 8080 → rejeté', tone: 'warning', side: 'bottom' },
            text: {
                1: "Une machine inconnue envoie un message à la box, sur le port `8080`. La box cherche dans sa table… aucune conversation ne correspond. Elle ne sait pas à qui le remettre : le message est rejeté.",
                2: "Sans entrée dans la table NAT, un paquet entrant ne peut pas être associé à un appareil interne. C'est un effet du NAT, mais la protection réelle repose sur le pare-feu de la box.",
                3: "Le NAT n'est pas un mécanisme de sécurité en soi : un pare-feu à états offre la même protection en IPv6, sans traduction.",
            },
        },
        {
            id: 'forwarding',
            title: 'Héberger un service : la redirection de port',
            focus: ['box'],
            status: 'ok',
            packets: [],
            terms: ['port-forwarding', 'cgnat'],
            table: {
                title: 'Règles de redirection de port (exemple)',
                columns: ['Port public', 'Vers', 'Usage'],
                rows: [['8080/TCP', '192.168.1.50:80', 'caméra de surveillance']],
            },
            text: {
                1: "Pour qu'un appareil de la maison soit joignable depuis Internet (une caméra, un petit serveur), on ajoute une règle fixe : la [[port-forwarding|redirection de port]].",
                2: "La règle crée une entrée permanente `8080 → 192.168.1.50:80`. Attention : derrière un [[cgnat|CGNAT]] d'opérateur, l'abonné ne contrôle pas l'adresse publique et ne peut pas créer cette règle.",
                3: "Les limites du NAT (protocoles qui transportent des adresses, pair-à-pair, voix sur IP) ont conduit à des techniques de traversée (STUN, TURN, ICE) et motivent le déploiement d'IPv6.",
            },
        },
    ],
};

export const natVariants: ScenarioVariant[] = [{ id: 'pat', label: 'NAT/PAT', description: natScenario.summary, scenario: natScenario }];
