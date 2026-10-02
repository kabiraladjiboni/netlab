import type { PacketDetails, ScenarioStep, ScenarioVariant } from '@/engine/types';
import { NET } from './addressing';
import { ipv4, relSeq, tcp } from './builders';

const C = NET.tcp.clientIsn;
const S = NET.tcp.serverIsn;
const path = ['client', 'net', 'server'];
const back = ['server', 'net', 'client'];

const stateTable = (client: string, server: string, highlight?: number) => ({
    title: 'État de la connexion TCP',
    caption: 'Chaque extrémité mémorise l’état de la connexion (RFC 9293).',
    columns: ['Extrémité', 'État'],
    rows: [
        ['Client 192.168.1.10:51514', client],
        ['Serveur 198.51.100.20:443', server],
    ],
    highlight,
    highlightKind: 'new' as const,
});

const segment = (
    id: string,
    title: string,
    fromClient: boolean,
    flags: string,
    seq: string,
    ack: string,
    beginner: PacketDetails['beginner'],
    note?: string,
    options?: string,
    headerLength = 40,
): PacketDetails => ({
    id,
    title,
    protocol: 'TCP',
    size: headerLength === 40 ? '74 octets' : headerLength === 32 ? '66 octets' : '54 octets',
    where: fromClient ? 'Du client vers le serveur' : 'Du serveur vers le client',
    beginner,
    note,
    layers: [
        ipv4({
            src: fromClient ? NET.pc.ip : NET.server.ip,
            dst: fromClient ? NET.server.ip : NET.pc.ip,
            ttl: fromClient ? 64 : 60,
            protocol: 'TCP',
            totalLength: 20 + headerLength,
        }),
        tcp({
            srcPort: fromClient ? NET.ports.client : 443,
            dstPort: fromClient ? 443 : NET.ports.client,
            seq,
            ack,
            flags,
            window: fromClient ? 64240 : 65160,
            headerLength,
            options,
        }),
    ],
});

const packets: Record<string, PacketDetails> = {
    syn: segment('syn', 'SYN — demande d’ouverture', true, '0x002 (SYN)', relSeq(0, C), '0', {
        who: 'Le client (le navigateur).',
        to: 'Le serveur, port 443.',
        why: 'Pour demander l’ouverture d’une connexion et annoncer son numéro de départ.',
        next: 'Le serveur accepte (SYN-ACK) ou refuse (RST).',
    }, 'Le numéro de séquence initial (ISN) est choisi de façon imprévisible pour des raisons de sécurité.', 'MSS = 1460, SACK autorisé, horodatage, facteur d’échelle = 7'),
    synack: segment('synack', 'SYN-ACK — acceptation', false, '0x012 (SYN, ACK)', relSeq(0, S), relSeq(1, C + 1), {
        who: 'Le serveur.',
        to: 'Le client.',
        why: 'Pour accepter, annoncer son propre numéro de départ et confirmer celui du client.',
        next: 'Le client confirme à son tour.',
    }, 'ack = ISN du client + 1 : le SYN compte pour un numéro de séquence.', 'MSS = 1460, SACK autorisé, horodatage, facteur d’échelle = 7'),
    ack: segment('ack', 'ACK — connexion établie', true, '0x010 (ACK)', relSeq(1, C + 1), relSeq(1, S + 1), {
        who: 'Le client.',
        to: 'Le serveur.',
        why: 'Pour confirmer qu’il a reçu le SYN-ACK.',
        next: 'Les deux côtés peuvent envoyer des données.',
    }, undefined, 'NOP, NOP, horodatage', 32),
    data: segment('data', 'Données (PSH, ACK)', true, '0x018 (PSH, ACK)', '1 (relatif)', '1 (relatif)', {
        who: 'Le client.',
        to: 'Le serveur.',
        why: 'Pour envoyer les premières données (par exemple le début de la négociation TLS).',
        next: 'Le serveur accuse réception avec un ACK.',
    }, 'Le numéro d’acquittement du serveur augmentera du nombre d’octets reçus.', undefined, 32),
    fin: segment('fin', 'FIN, ACK — fin d’envoi', true, '0x011 (FIN, ACK)', '518 (relatif, illustratif)', '3897 (relatif, illustratif)', {
        who: 'Le client.',
        to: 'Le serveur.',
        why: 'Pour signaler qu’il n’a plus rien à envoyer.',
        next: 'Le serveur confirme puis ferme à son tour.',
    }, undefined, undefined, 32),
    rst: segment('rst', 'RST, ACK — connexion refusée', false, '0x014 (RST, ACK)', '0', relSeq(1, C + 1), {
        who: 'Le serveur.',
        to: 'Le client.',
        why: 'Aucun programme n’écoute sur ce port.',
        next: 'Le client abandonne immédiatement : « connexion refusée ».',
    }, undefined, undefined, 20),
};

const base = {
    viewBox: { w: 1000, h: 380 },
    zones: [
        { id: 'c', label: 'Client', x: 30, y: 60, w: 260, h: 280, tone: 'home' as const },
        { id: 's', label: 'Serveur', x: 710, y: 60, w: 260, h: 280, tone: 'datacenter' as const },
    ],
    nodes: [
        {
            id: 'client',
            kind: 'laptop' as const,
            label: 'Client',
            sublabel: `${NET.pc.ip}:${NET.ports.client}`,
            x: 160,
            y: 190,
            term: 'client',
            description: { 1: 'Le navigateur qui veut ouvrir une connexion.', 2: 'Il choisit un port source temporaire (51514) et un numéro de séquence initial.' },
        },
        {
            id: 'net',
            kind: 'cloud' as const,
            label: 'Réseau',
            sublabel: 'box, NAT et routeurs simplifiés',
            x: 500,
            y: 190,
            description: { 1: 'Tout le trajet (box, NAT, Internet) est simplifié ici pour se concentrer sur TCP.' },
        },
        {
            id: 'server',
            kind: 'server' as const,
            label: 'Serveur',
            sublabel: `${NET.server.ip}:443`,
            x: 840,
            y: 190,
            term: 'serveur',
            description: { 1: 'Le serveur Web, en attente de connexions.', 2: 'Un programme « écoute » sur le port 443 (état LISTEN).' },
        },
    ],
    links: [
        { from: 'client', to: 'net', medium: 'wan' as const },
        { from: 'net', to: 'server', medium: 'wan' as const },
    ],
    packets,
};

const assumptions = [
    'Le NAT de la box n’est pas représenté : les adresses et ports sont ceux vus par le client.',
    'Numéros de séquence : valeurs brutes illustratives ; Wireshark affiche par défaut des numéros relatifs (0, 1…).',
    'Adresses de documentation (RFC 5737).',
];

const intro: ScenarioStep = {
    id: 'intro',
    title: 'Avant de parler, il faut se synchroniser',
    focus: ['client', 'server'],
    packets: [],
    terms: ['tcp', 'handshake'],
    table: stateTable('CLOSED', 'LISTEN'),
    text: {
        1: "Avec [[tcp|TCP]], deux machines ne s'envoient pas de données au hasard : elles ouvrent d'abord une **connexion**, comme on s'assure que l'autre écoute avant de parler au téléphone.\n\nCela se fait en trois messages : la [[handshake|poignée de main]].",
        2: "TCP numérote chaque octet envoyé. Avant d'échanger, chaque côté doit annoncer son numéro de départ (ISN) et s'assurer que l'autre l'a bien reçu.",
        3: "État initial : le serveur est en LISTEN (socket passive sur le port 443), le client en CLOSED. Les numéros de séquence sont sur 32 bits.",
    },
};

const steps: ScenarioStep[] = [
    intro,
    {
        id: 'syn',
        title: '1. SYN : « Je voudrais ouvrir une connexion »',
        focus: ['client'],
        details: 'syn',
        terms: ['drapeau-tcp', 'numero-de-sequence'],
        packets: [{ id: 'p-syn', label: 'SYN', tone: 'request', path, hop: 1.4, inspect: 'syn' }],
        table: stateTable('SYN-SENT', 'LISTEN', 0),
        text: {
            1: "Le client envoie un message **SYN** (synchroniser). Il dit : « Je veux ouvrir une connexion, et je commencerai à compter à partir de tel numéro ».",
            2: "Drapeau SYN positionné, numéro de séquence initial `x` (relatif 0). Le segment ne contient pas de données mais annonce des options : [[mss|MSS]] 1460, SACK, mise à l'échelle de la fenêtre.",
            3: "Seq brut = 2817394562. Le SYN consomme un numéro de séquence. Le client passe en SYN-SENT et arme un délai de retransmission (environ 1 s au départ).",
        },
    },
    {
        id: 'synack',
        title: '2. SYN-ACK : « D’accord, et voici mon numéro »',
        focus: ['server'],
        details: 'synack',
        terms: ['drapeau-tcp'],
        packets: [{ id: 'p-synack', label: 'SYN-ACK', tone: 'response', path: back, hop: 1.4, inspect: 'synack' }],
        table: stateTable('SYN-SENT', 'SYN-RECEIVED', 1),
        text: {
            1: "Le serveur accepte. Son message fait deux choses à la fois : il confirme avoir reçu la demande (**ACK**) et annonce son propre numéro de départ (**SYN**).",
            2: "SYN-ACK : seq = `y` (numéro initial du serveur), ack = `x + 1`. L'acquittement indique le **prochain** numéro attendu.",
            3: "Seq brut = 1093847201, ack brut = 2817394563. Le serveur garde la demande en attente (file des connexions semi-ouvertes). Les attaques « SYN flood » saturent cette file ; les SYN cookies permettent de s'en protéger.",
        },
    },
    {
        id: 'ack',
        title: '3. ACK : « Bien reçu, c’est parti ! »',
        focus: ['client', 'server'],
        details: 'ack',
        status: 'ok',
        packets: [{ id: 'p-ack', label: 'ACK', tone: 'control', path, hop: 1.4, inspect: 'ack' }],
        table: stateTable('ESTABLISHED', 'ESTABLISHED', 0),
        text: {
            1: "Le client confirme qu'il a bien reçu la réponse. Chacun connaît maintenant le numéro de départ de l'autre : la connexion est **ouverte**.",
            2: "ACK : seq = `x + 1`, ack = `y + 1`. Pourquoi trois messages ? Parce que chaque sens doit être annoncé et confirmé ; le SYN et l'ACK du serveur sont regroupés en un seul message.",
            3: "Les deux extrémités passent en ESTABLISHED. Ce troisième segment peut déjà porter des données. Coût : un aller-retour (RTT) avant le premier échange applicatif.",
        },
    },
    {
        id: 'data',
        title: 'Les données circulent, avec accusés de réception',
        focus: ['client', 'server'],
        details: 'data',
        terms: ['segment', 'fenetre-tcp', 'retransmission-tcp'],
        packets: [
            { id: 'd1', label: 'Données', tone: 'secure', path, hop: 1 },
            { id: 'd1ack', label: 'ACK', tone: 'control', path: back, hop: 1, after: 'd1' },
        ],
        text: {
            1: "Maintenant, les données peuvent circuler. Chaque morceau reçu est confirmé ; si une confirmation n'arrive pas, l'émetteur renvoie le morceau.",
            2: "Chaque [[segment|segment]] porte un numéro de séquence ; l'acquittement indique jusqu'où les données ont été reçues. La [[fenetre-tcp|fenêtre]] limite la quantité envoyée sans confirmation.",
            3: "Acquittements cumulatifs, SACK pour signaler les trous, retransmission sur délai (RTO) ou après trois ACK dupliqués. Le contrôle de congestion ajuste le débit.",
        },
    },
    {
        id: 'fin',
        title: 'Fermeture polie : FIN et ACK',
        focus: ['client', 'server'],
        details: 'fin',
        packets: [
            { id: 'f1', label: 'FIN', tone: 'control', path, hop: 0.9, inspect: 'fin' },
            { id: 'f2', label: 'ACK', tone: 'control', path: back, hop: 0.9, after: 'f1' },
            { id: 'f3', label: 'FIN', tone: 'control', path: back, hop: 0.9, after: 'f2' },
            { id: 'f4', label: 'ACK', tone: 'control', path, hop: 0.9, after: 'f3' },
        ],
        table: stateTable('TIME-WAIT', 'CLOSED', 0),
        text: {
            1: "À la fin, chaque côté annonce qu'il a terminé (**FIN**) et l'autre confirme (**ACK**). La connexion est fermée proprement.",
            2: "Fermeture en quatre segments (FIN, ACK, FIN, ACK), car chaque sens se ferme indépendamment. Le serveur combine souvent son ACK et son FIN.",
            3: "Celui qui ferme en premier passe en TIME-WAIT (2 × MSL) pour absorber d'éventuels segments retardés. Un RST interrompt au contraire la connexion sans négociation.",
        },
    },
];

const refusedSteps: ScenarioStep[] = [
    { ...intro, table: stateTable('CLOSED', 'aucun programme en écoute sur 443') },
    steps[1],
    {
        id: 'rst',
        title: 'RST : « Personne ici »',
        focus: ['server', 'client'],
        details: 'rst',
        status: 'error',
        packets: [{ id: 'p-rst', label: 'RST, ACK', tone: 'error', path: back, hop: 1.4, inspect: 'rst' }],
        bubble: { node: 'client', text: 'Connexion refusée', tone: 'error' },
        table: stateTable('CLOSED', 'CLOSED', 0),
        text: {
            1: "Aucun programme n'attend sur ce port. Le serveur répond aussitôt par un **RST** : « connexion refusée ». Le navigateur affiche une erreur immédiatement.",
            2: "Le segment RST, ACK acquitte le SYN (ack = x + 1) et met fin à la tentative. L'échec est instantané, contrairement à un pare-feu qui détruirait le SYN sans répondre.",
            3: "Côté diagnostic : RST immédiat → port fermé ; aucune réponse et retransmissions du SYN → filtrage (DROP) ; ICMP « destination injoignable » → filtrage avec rejet (REJECT).",
        },
    },
];

export const tcpVariants: ScenarioVariant[] = [
    {
        id: 'normal',
        label: 'Connexion réussie',
        description: 'SYN, SYN-ACK, ACK, puis données et fermeture.',
        scenario: { id: 'tcp-normal', title: 'La poignée de main TCP', summary: 'Ouverture, échange et fermeture d’une connexion TCP.', assumptions, ...base, steps },
    },
    {
        id: 'refus',
        label: 'Port fermé (RST)',
        description: 'Le serveur répond par un RST : connexion refusée.',
        status: 'error',
        scenario: { id: 'tcp-refused', title: 'Connexion refusée', summary: 'Aucun programme n’écoute sur le port : le serveur répond par un RST.', assumptions, ...base, steps: refusedSteps },
    },
];
