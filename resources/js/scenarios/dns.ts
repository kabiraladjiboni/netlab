import type { PacketDetails, ScenarioStep, ScenarioVariant } from '@/engine/types';
import { NET } from './addressing';
import { ipv4, udp } from './builders';

const dnsLayer = (fields: { name: string; value: string; level: 2 | 3; explain?: string }[]) => ({ name: 'DNS', layer: 'app' as const, fields });

const query = (id: string, title: string, src: string, dst: string, where: string, rd: boolean, beginner: PacketDetails['beginner'], qname = 'www.example.com'): PacketDetails => ({
    id,
    title,
    protocol: 'DNS',
    where,
    beginner,
    layers: [
        ipv4({ src, dst, ttl: 64, protocol: 'UDP', totalLength: 61, df: false }),
        udp({ srcPort: src === NET.pc.ip ? NET.ports.dnsClient : 41923, dstPort: 53, length: 41 }),
        dnsLayer([
            { name: 'Question', value: `${qname}, type A, classe IN`, level: 2 },
            { name: 'Drapeaux', value: rd ? '0x0100 (requête, RD = 1)' : '0x0000 (requête, RD = 0)', level: 3, explain: rd ? 'Récursion demandée : « fais tout le travail pour moi ».' : 'Requête itérative : le résolveur ne demande pas de récursion aux serveurs de la hiérarchie.' },
            { name: 'Identifiant', value: src === NET.pc.ip ? '0x3f2a' : '0x8c51 (illustratif)', level: 3 },
        ]),
    ],
});

const packets: Record<string, PacketDetails> = {
    'q-client': query('q-client', 'Requête du client au résolveur', NET.pc.ip, NET.resolver.ip, 'Entre l’ordinateur et le résolveur (la box et son NAT sont simplifiés)', true, {
        who: 'Ton ordinateur.',
        to: 'Le résolveur DNS.',
        why: 'Pour obtenir l’adresse IP de www.example.com.',
        next: 'Le résolveur cherche dans son cache, sinon interroge la hiérarchie DNS.',
    }),
    'q-root': query('q-root', 'Requête du résolveur à un serveur racine', NET.resolver.ip, '198.41.0.4 (a.root-servers.net)', 'Entre le résolveur et un serveur racine', false, {
        who: 'Le résolveur.',
        to: 'Un serveur racine.',
        why: 'Pour savoir qui gère les noms en « .com ».',
        next: 'La racine répond par une délégation.',
    }),
    'r-root': {
        id: 'r-root',
        title: 'Réponse de la racine : délégation vers .com',
        protocol: 'DNS',
        where: 'Du serveur racine vers le résolveur',
        beginner: { who: 'Le serveur racine.', to: 'Le résolveur.', why: 'Il ne connaît pas la réponse mais sait qui gère « .com ».', next: 'Le résolveur interroge un serveur de .com.' },
        layers: [
            dnsLayer([
                { name: 'Réponse', value: 'aucune (pas de section réponse)', level: 2 },
                { name: 'Autorité', value: 'com. NS a.gtld-servers.net. (et les autres serveurs de .com)', level: 2, explain: 'Délégation : « adresse-toi à ces serveurs ».' },
                { name: 'Additionnel', value: 'adresses IP de ces serveurs (« glue »)', level: 3 },
                { name: 'Drapeaux', value: 'réponse, AA = 0, RCODE = NOERROR', level: 3 },
            ]),
        ],
        note: 'Avec la minimisation des requêtes (RFC 9156), le résolveur peut ne demander que « com. » à la racine.',
    },
    'r-tld': {
        id: 'r-tld',
        title: 'Réponse du serveur .com : délégation vers example.com',
        protocol: 'DNS',
        where: 'Du serveur .com vers le résolveur',
        beginner: { who: 'Un serveur du domaine .com.', to: 'Le résolveur.', why: 'Il sait quels serveurs gèrent example.com.', next: 'Le résolveur interroge le serveur faisant autorité.' },
        layers: [dnsLayer([
            { name: 'Autorité', value: 'example.com. NS (serveurs faisant autorité de la zone)', level: 2 },
            { name: 'Drapeaux', value: 'réponse, AA = 0', level: 3 },
        ])],
    },
    'r-auth': {
        id: 'r-auth',
        title: 'Réponse faisant autorité',
        protocol: 'DNS',
        where: 'Du serveur faisant autorité vers le résolveur',
        beginner: { who: 'Le serveur officiel du domaine example.com.', to: 'Le résolveur.', why: 'Pour donner la réponse finale.', next: 'Le résolveur la garde en cache et la transmet au client.' },
        layers: [dnsLayer([
            { name: 'Réponse', value: 'www.example.com. 300 IN A 198.51.100.20', level: 2, explain: 'Nom, durée de validité (TTL), classe, type et adresse.' },
            { name: 'Drapeaux', value: 'réponse, AA = 1 (réponse faisant autorité)', level: 3 },
        ])],
        note: 'Adresse illustrative de documentation : l’adresse réelle de www.example.com est différente.',
    },
    'r-client': {
        id: 'r-client',
        title: 'Réponse du résolveur au client',
        protocol: 'DNS',
        where: 'Du résolveur vers l’ordinateur',
        beginner: { who: 'Le résolveur.', to: 'Ton ordinateur.', why: 'Pour lui donner l’adresse demandée.', next: 'L’ordinateur peut contacter le serveur Web.' },
        layers: [
            ipv4({ src: NET.resolver.ip, dst: NET.pc.ip, ttl: 60, protocol: 'UDP', totalLength: 77, df: false }),
            udp({ srcPort: 53, dstPort: NET.ports.dnsClient, length: 57 }),
            dnsLayer([
                { name: 'Réponse', value: 'www.example.com → A 198.51.100.20 (TTL 300 s)', level: 2 },
                { name: 'Identifiant', value: '0x3f2a (identique à la question)', level: 3 },
                { name: 'Drapeaux', value: '0x8180 (réponse, RD = 1, RA = 1, AA = 0, NOERROR)', level: 3 },
            ]),
        ],
    },
};

const scene = {
    viewBox: { w: 1000, h: 500 },
    zones: [
        { id: 'client', label: 'Ton réseau', x: 20, y: 150, w: 220, h: 230, tone: 'home' as const },
        { id: 'fai', label: 'Fournisseur d’accès', x: 260, y: 150, w: 260, h: 230, tone: 'isp' as const },
        { id: 'hier', label: 'Hiérarchie DNS', x: 580, y: 30, w: 400, h: 450, tone: 'dns' as const },
    ],
    nodes: [
        {
            id: 'pc', kind: 'laptop' as const, label: 'Ordinateur', sublabel: NET.pc.ip, x: 120, y: 260, term: 'client',
            description: { 1: 'Ton ordinateur pose la question.', 2: 'Son « stub resolver » envoie une requête récursive au résolveur configuré.' },
            facts: [{ label: 'Résolveur configuré', value: NET.resolver.ip }],
        },
        {
            id: 'resolver', kind: 'dns' as const, label: 'Résolveur', sublabel: NET.resolver.ip, x: 390, y: 260, term: 'resolveur-dns',
            description: { 1: 'Il cherche la réponse pour toi et garde les réponses en mémoire.', 2: 'Résolveur récursif du FAI, avec cache.', 3: 'Il effectue la résolution itérative et peut valider DNSSEC.' },
        },
        {
            id: 'root', kind: 'dns' as const, label: 'Serveur racine', sublabel: '« . »', x: 790, y: 105, term: 'dns',
            description: { 1: 'Le sommet de l’annuaire : il sait qui gère chaque domaine de premier niveau (.com, .bj, .org…).', 2: '13 identités (a à m.root-servers.net) répliquées dans des centaines de sites par anycast.' },
        },
        {
            id: 'tld', kind: 'dns' as const, label: 'Serveur .com', sublabel: 'TLD', x: 790, y: 255, term: 'dns',
            description: { 1: 'Il gère les noms en .com et sait quels serveurs connaissent example.com.' },
        },
        {
            id: 'auth', kind: 'dns' as const, label: 'Faisant autorité', sublabel: 'example.com', x: 790, y: 405, term: 'dns',
            description: { 1: 'Le serveur officiel du domaine : il détient la réponse.', 2: 'Ses réponses portent le drapeau AA (Authoritative Answer).' },
        },
    ],
    links: [
        { from: 'pc', to: 'resolver', medium: 'wan' as const },
        { from: 'resolver', to: 'root', medium: 'logical' as const },
        { from: 'resolver', to: 'tld', medium: 'logical' as const },
        { from: 'resolver', to: 'auth', medium: 'logical' as const },
    ],
    packets,
};

const assumptions = [
    'Adresses de documentation (RFC 5737). L’adresse réelle de www.example.com est différente.',
    'Seule la requête A (IPv4) est montrée ; un client envoie souvent aussi une requête AAAA (IPv6).',
    'Les trajets entre le résolveur et les serveurs de la hiérarchie traversent des routeurs non représentés.',
];

const question: ScenarioStep = {
    id: 'question',
    title: 'Requête : l’ordinateur pose la question',
    focus: ['pc', 'resolver'],
    details: 'q-client',
    terms: ['dns', 'resolveur-dns', 'nom-de-domaine'],
    packets: [{ id: 'q', label: 'A ?', tone: 'request', path: ['pc', 'resolver'], hop: 1.4, inspect: 'q-client' }],
    text: {
        1: "Ton ordinateur veut joindre `www.example.com`. Il demande au [[resolveur-dns|résolveur DNS]] : « Quelle est l'adresse IP de ce nom ? ».",
        2: "Requête DNS de type **A**, en UDP vers le port 53, avec le drapeau RD (récursion demandée) : le résolveur doit fournir une réponse complète.",
        3: "Le client (stub resolver) ne parle qu'au résolveur. Identifiant de transaction 0x3f2a, port source aléatoire : ces deux valeurs aléatoires compliquent l'empoisonnement de cache.",
    },
};

const finalAnswer = (fromCache: boolean): ScenarioStep => ({
    id: 'reponse',
    title: 'Réponse : l’adresse IP est transmise',
    focus: ['resolver', 'pc'],
    details: 'r-client',
    status: 'ok',
    packets: [{ id: 'r', label: 'A ✓', tone: 'response', path: ['resolver', 'pc'], hop: 1.4, inspect: 'r-client' }],
    bubble: { node: 'pc', text: 'www.example.com → 198.51.100.20', tone: 'ok' },
    table: {
        title: 'Cache DNS de l’ordinateur',
        columns: ['Nom', 'Type', 'Adresse', 'Expire dans'],
        rows: [['www.example.com', 'A', NET.server.ip, fromCache ? '187 s' : '300 s']],
        highlight: 0,
        highlightKind: 'new',
    },
    text: {
        1: "Le résolveur renvoie l'adresse `198.51.100.20`. L'ordinateur la garde en mémoire quelques minutes et peut maintenant contacter le site.",
        2: fromCache
            ? "La réponse vient du cache du résolveur : son TTL restant (187 s ici) est transmis, pour que le client ne garde pas la réponse plus longtemps que prévu."
            : "Réponse avec RA = 1 (récursion disponible). Le client met la réponse en cache pendant 300 s (le [[ttl|TTL]]).",
        3: "La réponse du résolveur n'a pas le drapeau AA : elle ne vient pas directement d'un serveur faisant autorité. Le DNS ne fait que fournir l'adresse : la connexion au site est une étape distincte.",
    },
});

const cachedSteps: ScenarioStep[] = [
    question,
    {
        id: 'cache',
        title: 'Résolution : la réponse est déjà dans le cache',
        focus: ['resolver'],
        status: 'ok',
        packets: [],
        terms: ['cache-dns'],
        bubble: { node: 'resolver', text: 'Trouvé dans mon cache ✓', tone: 'ok' },
        table: {
            title: 'Cache du résolveur',
            columns: ['Nom', 'Type', 'Valeur', 'TTL restant'],
            rows: [
                ['com.', 'NS', 'a.gtld-servers.net. …', '41 h'],
                ['www.example.com.', 'A', NET.server.ip, '187 s'],
            ],
            highlight: 1,
            highlightKind: 'used',
        },
        text: {
            1: "Un autre client a demandé ce nom il y a peu : le résolveur a gardé la réponse. Il n'a donc **personne** à interroger.",
            2: "Le [[cache-dns|cache]] du résolveur est partagé par tous ses clients : les noms populaires y sont presque toujours présents.",
            3: "Le cache contient aussi les délégations (NS de .com, d'example.com…) : même sans la réponse finale, le résolveur peut souvent sauter les premières étapes.",
        },
    },
    finalAnswer(true),
];

const completeSteps: ScenarioStep[] = [
    question,
    {
        id: 'root',
        title: 'Résolution : le résolveur interroge la racine',
        focus: ['resolver', 'root'],
        details: 'r-root',
        packets: [
            { id: 'qr', label: '?', tone: 'request', path: ['resolver', 'root'], hop: 1.2, inspect: 'q-root' },
            { id: 'rr', label: '→ .com', tone: 'response', path: ['root', 'resolver'], hop: 1.2, after: 'qr', inspect: 'r-root' },
        ],
        bubble: { node: 'resolver', text: 'Pas en cache : je cherche', tone: 'warning', side: 'bottom' },
        text: {
            1: "Le résolveur ne connaît pas la réponse. Il commence par le sommet : un **serveur racine**. Celui-ci ne connaît pas l'adresse, mais il indique qui gère les noms en « .com ».",
            2: "Requête **itérative** : la racine répond par une **délégation** (enregistrements NS de .com), pas par l'adresse finale.",
            3: "En pratique, la délégation de .com est presque toujours en cache (TTL de 2 jours) : cette étape est rarement nécessaire.",
        },
    },
    {
        id: 'tld',
        title: 'Résolution : le serveur du « .com »',
        focus: ['resolver', 'tld'],
        details: 'r-tld',
        packets: [
            { id: 'qt', label: '?', tone: 'request', path: ['resolver', 'tld'], hop: 1.2 },
            { id: 'rt', label: '→ example.com', tone: 'response', path: ['tld', 'resolver'], hop: 1.2, after: 'qt', inspect: 'r-tld' },
        ],
        text: {
            1: "Le résolveur demande au serveur du **.com**. Réponse : « Je ne connais pas www.example.com, mais voici les serveurs officiels du domaine example.com ».",
            2: "Nouvelle délégation : le serveur de domaine de premier niveau (TLD) renvoie les serveurs faisant autorité pour `example.com`.",
        },
    },
    {
        id: 'auth',
        title: 'Résolution : le serveur faisant autorité répond',
        focus: ['resolver', 'auth'],
        details: 'r-auth',
        packets: [
            { id: 'qa', label: '?', tone: 'request', path: ['resolver', 'auth'], hop: 1.2 },
            { id: 'ra', label: 'A ✓', tone: 'response', path: ['auth', 'resolver'], hop: 1.2, after: 'qa', inspect: 'r-auth' },
        ],
        text: {
            1: "Enfin, le serveur officiel du domaine donne la vraie réponse : `198.51.100.20`. Le résolveur la garde en mémoire pour ses prochains clients.",
            2: "Réponse faisant autorité (AA = 1), avec un TTL de 300 s fixé par l'administrateur du domaine.",
            3: "Un résolveur validant vérifierait ici les signatures DNSSEC (RRSIG) en remontant la chaîne de confiance jusqu'à la racine.",
        },
    },
    finalAnswer(false),
];

const localCacheSteps: ScenarioStep[] = [
    {
        id: 'local',
        title: 'La réponse est déjà connue de l’ordinateur',
        focus: ['pc'],
        status: 'ok',
        packets: [],
        terms: ['cache-dns', 'ttl'],
        bubble: { node: 'pc', text: 'Déjà dans mon cache : aucune requête', tone: 'ok' },
        table: {
            title: 'Cache DNS de l’ordinateur',
            columns: ['Nom', 'Type', 'Adresse', 'Expire dans'],
            rows: [['www.example.com', 'A', NET.server.ip, '212 s']],
            highlight: 0,
            highlightKind: 'used',
        },
        text: {
            1: "Tu as visité ce site il y a quelques instants : ton ordinateur se souvient de l'adresse. **Aucun message** n'est envoyé sur le réseau.",
            2: "Tant que le TTL de l'entrée n'a pas expiré, le cache local du navigateur ou du système répond directement. C'est le cas le plus rapide.",
            3: "Sous Windows : `ipconfig /displaydns` affiche ce cache et `ipconfig /flushdns` le vide. Le navigateur possède souvent son propre cache.",
        },
    },
];

export const dnsVariants: ScenarioVariant[] = [
    {
        id: 'resolution-complete',
        label: 'Résolution complète',
        description: 'Le résolveur interroge racine, .com puis le serveur faisant autorité.',
        scenario: { id: 'dns-complete', title: 'Résolution DNS complète', summary: 'Requête, résolution itérative, réponse.', assumptions, ...scene, steps: completeSteps },
    },
    {
        id: 'cache-resolveur',
        label: 'En cache chez le résolveur',
        description: 'Le résolveur connaît déjà la réponse.',
        scenario: { id: 'dns-cache-resolver', title: 'Réponse depuis le cache du résolveur', summary: 'Requête, réponse immédiate du cache, réponse.', assumptions, ...scene, steps: cachedSteps },
    },
    {
        id: 'cache-local',
        label: 'En cache sur l’ordinateur',
        description: 'Aucune requête n’est nécessaire.',
        scenario: { id: 'dns-cache-local', title: 'Réponse depuis le cache local', summary: 'L’ordinateur connaît déjà l’adresse.', assumptions, ...scene, steps: localCacheSteps },
    },
];
