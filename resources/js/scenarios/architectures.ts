import type { Scenario } from '@/engine/types';

/** Schémas animés d'architectures types (page « Équipements »). */

const note = ['Architectures types simplifiées : les réseaux réels varient selon les besoins et les fabricants.'];

export const homeArchitecture: Scenario = {
    id: 'archi-maison',
    title: 'Réseau domestique',
    summary: 'La box concentre presque toutes les fonctions.',
    assumptions: note,
    viewBox: { w: 1000, h: 440 },
    zones: [{ id: 'home', label: 'Maison', x: 20, y: 30, w: 640, h: 380, tone: 'home' }],
    nodes: [
        { id: 'laptop', kind: 'laptop', label: 'Ordinateur', sublabel: 'Wi-Fi', x: 120, y: 110, description: { 1: 'Connecté en Wi-Fi.' } },
        { id: 'phone', kind: 'phone', label: 'Téléphone', sublabel: 'Wi-Fi', x: 120, y: 320, description: { 1: 'Connecté en Wi-Fi.' } },
        { id: 'tv', kind: 'iot', label: 'Télévision', sublabel: 'Ethernet', x: 330, y: 340, description: { 1: 'Branchée par câble.' } },
        { id: 'box', kind: 'box', label: 'Box', sublabel: 'routeur · NAT · DHCP · Wi-Fi', x: 420, y: 160, term: 'nat', description: { 1: 'Routeur, NAT/PAT, pare-feu, serveur DHCP, commutateur et point d’accès Wi-Fi réunis.' } },
        { id: 'ont', kind: 'ont', label: 'ONT', sublabel: 'fibre', x: 590, y: 160, description: { 1: 'Convertit le signal optique de la fibre (parfois intégré à la box).' } },
        { id: 'isp', kind: 'router', label: 'Fournisseur d’accès', x: 830, y: 160, term: 'fai', description: { 1: 'Le réseau de l’opérateur, puis Internet.' } },
    ],
    links: [
        { from: 'laptop', to: 'box', medium: 'wifi' },
        { from: 'phone', to: 'box', medium: 'wifi' },
        { from: 'tv', to: 'box', medium: 'ethernet' },
        { from: 'box', to: 'ont', medium: 'ethernet' },
        { from: 'ont', to: 'isp', medium: 'fiber' },
    ],
    packets: {},
    steps: [
        {
            id: 'local',
            title: 'Dans la maison : tout passe par la box',
            focus: ['laptop', 'box', 'tv'],
            packets: [{ id: 'cast', label: 'vidéo', tone: 'request', path: ['laptop', 'box', 'tv'], hop: 1 }],
            text: { 1: 'Entre deux appareils de la maison, la box joue le rôle de point d’accès Wi-Fi et de commutateur : le trafic ne sort pas sur Internet.', 2: 'Communication locale de couche 2 : pas de routage ni de NAT entre deux appareils du même réseau 192.168.1.0/24.' },
        },
        {
            id: 'internet',
            title: 'Vers Internet : routeur, NAT et fibre',
            focus: ['phone', 'box', 'ont', 'isp'],
            packets: [
                { id: 'out', label: 'requête', tone: 'request', path: ['phone', 'box', 'ont', 'isp'], hop: 0.9 },
                { id: 'in', label: 'réponse', tone: 'response', path: ['isp', 'ont', 'box', 'phone'], hop: 0.9, after: 'out' },
            ],
            text: { 1: 'Vers Internet, la box route le trafic, traduit les adresses (NAT) et l’envoie par la fibre à travers l’ONT jusqu’au fournisseur d’accès.', 2: 'La box est la passerelle par défaut ; l’ONT ne fait que la conversion optique/électrique.' },
        },
    ],
};

export const enterpriseArchitecture: Scenario = {
    id: 'archi-entreprise',
    title: 'Réseau d’entreprise',
    summary: 'Postes, VLAN, serveurs internes, pare-feu et DMZ.',
    assumptions: note,
    viewBox: { w: 1000, h: 480 },
    zones: [
        { id: 'users', label: 'Utilisateurs (VLAN 10, 20)', x: 20, y: 30, w: 330, h: 420, tone: 'vlan-a' },
        { id: 'srv', label: 'Serveurs internes', x: 370, y: 300, w: 300, h: 150, tone: 'datacenter' },
        { id: 'dmz', label: 'DMZ', x: 690, y: 30, w: 290, h: 160, tone: 'isp' },
    ],
    nodes: [
        { id: 'pc1', kind: 'desktop', label: 'Poste', sublabel: 'VLAN 10', x: 100, y: 110, description: { 1: 'Poste de travail.' } },
        { id: 'ap', kind: 'ap', label: 'Point d’accès', sublabel: 'Wi-Fi 802.1X', x: 100, y: 360, term: 'vlan', description: { 1: 'Wi-Fi d’entreprise, authentification individuelle (802.1X).' } },
        { id: 'access', kind: 'switch', label: 'Commutateur d’accès', x: 270, y: 235, term: 'vlan', description: { 1: 'Ports d’accès par VLAN, trunk vers le cœur.' } },
        { id: 'core', kind: 'switch', label: 'Cœur (L3)', sublabel: 'routage inter-VLAN', x: 500, y: 180, term: 'routage', description: { 1: 'Commutateur de niveau 3 : il route entre les VLAN.' } },
        { id: 'files', kind: 'server', label: 'Serveur de fichiers', x: 450, y: 380, description: { 1: 'Serveur interne.' } },
        { id: 'dhcp', kind: 'dns', label: 'DNS / DHCP', x: 600, y: 380, term: 'dns', description: { 1: 'Services d’infrastructure internes.' } },
        { id: 'fw', kind: 'firewall', label: 'Pare-feu', x: 720, y: 260, term: 'pare-feu', description: { 1: 'Filtre les flux entre Internet, la DMZ et le réseau interne.' } },
        { id: 'web', kind: 'server', label: 'Serveur Web public', sublabel: 'DMZ', x: 830, y: 110, description: { 1: 'Accessible depuis Internet, isolé du réseau interne.' } },
        { id: 'net', kind: 'cloud', label: 'Internet', x: 900, y: 360, description: { 1: 'Accès Internet de l’entreprise.' } },
    ],
    links: [
        { from: 'pc1', to: 'access', medium: 'ethernet' },
        { from: 'ap', to: 'access', medium: 'ethernet' },
        { from: 'access', to: 'core', medium: 'trunk' },
        { from: 'core', to: 'files', medium: 'ethernet' },
        { from: 'core', to: 'dhcp', medium: 'ethernet' },
        { from: 'core', to: 'fw', medium: 'ethernet' },
        { from: 'fw', to: 'web', medium: 'ethernet' },
        { from: 'fw', to: 'net', medium: 'wan' },
    ],
    packets: {},
    steps: [
        {
            id: 'interne',
            title: 'Accès à un serveur interne',
            focus: ['pc1', 'access', 'core', 'files'],
            packets: [{ id: 'smb', label: 'fichier', tone: 'request', path: ['pc1', 'access', 'core', 'files'], hop: 0.9 }],
            text: { 1: 'Le poste rejoint le serveur de fichiers en passant par le commutateur d’accès puis le cœur de réseau, qui route entre les VLAN.', 2: 'Trunk 802.1Q entre accès et cœur ; routage inter-VLAN sur le commutateur de niveau 3.' },
        },
        {
            id: 'sortie',
            title: 'Sortie vers Internet à travers le pare-feu',
            focus: ['core', 'fw', 'net'],
            packets: [{ id: 'web-out', label: 'HTTPS', tone: 'secure', path: ['pc1', 'access', 'core', 'fw', 'net'], hop: 0.75 }],
            text: { 1: 'Tout le trafic vers Internet passe par le pare-feu, qui applique la politique de sécurité.', 2: 'Le pare-feu réalise souvent aussi le NAT et peut journaliser les flux.' },
        },
        {
            id: 'dmz',
            title: 'Les visiteurs d’Internet n’atteignent que la DMZ',
            focus: ['net', 'fw', 'web'],
            status: 'ok',
            packets: [{ id: 'visit', label: 'visiteur', tone: 'response', path: ['net', 'fw', 'web'], hop: 1 }],
            text: { 1: 'Le site public est placé dans une zone séparée (DMZ) : un visiteur extérieur peut l’atteindre, mais pas le réseau interne.', 2: 'Règles typiques : Internet → DMZ autorisé sur 443 ; DMZ → interne interdit sauf exceptions précises.' },
        },
    ],
};

export const campusArchitecture: Scenario = {
    id: 'archi-campus',
    title: 'Réseau de campus',
    summary: 'Plusieurs bâtiments reliés en fibre à un cœur redondant.',
    assumptions: note,
    viewBox: { w: 1000, h: 460 },
    zones: [
        { id: 'b1', label: 'Bâtiment A', x: 20, y: 30, w: 260, h: 180, tone: 'lan' },
        { id: 'b2', label: 'Bâtiment B', x: 20, y: 250, w: 260, h: 180, tone: 'lan' },
        { id: 'core', label: 'Salle réseau', x: 360, y: 90, w: 300, h: 290, tone: 'datacenter' },
    ],
    nodes: [
        { id: 'a', kind: 'switch', label: 'Distribution A', x: 150, y: 120, description: { 1: 'Commutateur du bâtiment A.' } },
        { id: 'b', kind: 'switch', label: 'Distribution B', x: 150, y: 340, description: { 1: 'Commutateur du bâtiment B.' } },
        { id: 'c1', kind: 'switch', label: 'Cœur 1', x: 510, y: 150, term: 'routage', description: { 1: 'Cœur redondant (deux équipements).' } },
        { id: 'c2', kind: 'switch', label: 'Cœur 2', x: 510, y: 310, term: 'routage', description: { 1: 'Second cœur : si l’un tombe, l’autre prend le relais.' } },
        { id: 'edge', kind: 'router', label: 'Routeur de bordure', x: 760, y: 230, description: { 1: 'Sortie vers l’opérateur.' } },
        { id: 'net', kind: 'cloud', label: 'Opérateur / Internet', x: 920, y: 230, description: { 1: 'Le monde extérieur.' } },
    ],
    links: [
        { from: 'a', to: 'c1', medium: 'fiber' },
        { from: 'a', to: 'c2', medium: 'fiber' },
        { from: 'b', to: 'c1', medium: 'fiber' },
        { from: 'b', to: 'c2', medium: 'fiber' },
        { from: 'c1', to: 'c2', medium: 'trunk' },
        { from: 'c1', to: 'edge', medium: 'fiber' },
        { from: 'c2', to: 'edge', medium: 'fiber' },
        { from: 'edge', to: 'net', medium: 'wan' },
    ],
    packets: {},
    steps: [
        {
            id: 'normal',
            title: 'Chaque bâtiment est relié deux fois',
            focus: ['a', 'c1', 'b'],
            packets: [{ id: 'ab', label: 'données', tone: 'request', path: ['a', 'c1', 'b'], hop: 1.1 }],
            text: { 1: 'Les bâtiments sont reliés au cœur de réseau par de la fibre, en double, pour résister aux pannes.', 2: 'Liens redondants : agrégation (LACP), spanning tree ou routage (OSPF) selon la conception.' },
        },
        {
            id: 'panne',
            title: 'Si un cœur tombe, l’autre prend le relais',
            focus: ['a', 'c2', 'b'],
            status: 'warning',
            packets: [{ id: 'ab2', label: 'données', tone: 'request', path: ['a', 'c2', 'b'], hop: 1.1 }],
            bubble: { node: 'c1', text: 'Cœur 1 en panne', tone: 'warning', side: 'bottom' },
            text: { 1: 'Le cœur 1 est en panne : le trafic passe automatiquement par le cœur 2.', 2: 'La convergence dépend des protocoles : quelques secondes avec RSTP, souvent moins avec un routage rapide et BFD.' },
        },
    ],
};

export const operatorArchitecture: Scenario = {
    id: 'archi-operateur',
    title: 'Réseau d’opérateur',
    summary: 'Accès, collecte, cœur et interconnexion avec Internet.',
    assumptions: note,
    viewBox: { w: 1000, h: 440 },
    zones: [
        { id: 'access', label: 'Accès', x: 20, y: 30, w: 250, h: 380, tone: 'home' },
        { id: 'collect', label: 'Collecte', x: 290, y: 30, w: 200, h: 380, tone: 'isp' },
        { id: 'core', label: 'Cœur', x: 510, y: 30, w: 240, h: 380, tone: 'internet' },
        { id: 'peer', label: 'Interconnexion', x: 770, y: 30, w: 210, h: 380, tone: 'datacenter' },
    ],
    nodes: [
        { id: 'home', kind: 'ont', label: 'Abonné fibre', x: 90, y: 120, description: { 1: 'Box et ONT d’un abonné.' } },
        { id: 'mobile', kind: 'tower', label: 'Antenne 4G/5G', x: 90, y: 320, description: { 1: 'Station de base du réseau mobile.' } },
        { id: 'olt', kind: 'switch', label: 'OLT / agrégation', x: 220, y: 220, description: { 1: 'Équipements d’accès : OLT pour la fibre, agrégation des antennes.' } },
        { id: 'bng', kind: 'router', label: 'BNG / passerelle', x: 390, y: 220, description: { 1: 'Authentifie les abonnés, attribue les adresses, applique les offres.' } },
        { id: 'core1', kind: 'router', label: 'Routeur de cœur', x: 630, y: 140, term: 'routage', description: { 1: 'Cœur MPLS à très haut débit.' } },
        { id: 'core2', kind: 'router', label: 'Routeur de cœur', x: 630, y: 310, term: 'routage', description: { 1: 'Cœur redondant.' } },
        { id: 'ix', kind: 'cloud', label: 'Point d’échange / transit', x: 880, y: 220, term: 'bgp', description: { 1: 'Interconnexion avec les autres réseaux par BGP.' } },
    ],
    links: [
        { from: 'home', to: 'olt', medium: 'fiber' },
        { from: 'mobile', to: 'olt', medium: 'fiber' },
        { from: 'olt', to: 'bng', medium: 'fiber' },
        { from: 'bng', to: 'core1', medium: 'fiber' },
        { from: 'bng', to: 'core2', medium: 'fiber' },
        { from: 'core1', to: 'core2', medium: 'fiber' },
        { from: 'core1', to: 'ix', medium: 'wan' },
        { from: 'core2', to: 'ix', medium: 'wan' },
    ],
    packets: {},
    steps: [
        {
            id: 'collecte',
            title: 'Du client au cœur de réseau',
            focus: ['home', 'olt', 'bng'],
            packets: [{ id: 'up', label: 'trafic', tone: 'request', path: ['home', 'olt', 'bng', 'core1'], hop: 0.9 }],
            text: { 1: 'Le trafic des abonnés (fibre ou mobile) est rassemblé, puis traité par les équipements qui gèrent les abonnements.', 2: 'Réseau d’accès (FTTH/GPON, radio), collecte, puis BNG (sessions PPPoE ou IPoE, adressage, CGNAT éventuel).' },
        },
        {
            id: 'sortie',
            title: 'Le cœur relie aux autres réseaux',
            focus: ['core1', 'core2', 'ix'],
            packets: [{ id: 'out', label: 'trafic', tone: 'request', path: ['core1', 'ix'], hop: 1.2 }, { id: 'back', label: 'réponse', tone: 'response', path: ['ix', 'core2', 'bng', 'olt', 'mobile'], hop: 0.8, after: 'out' }],
            text: { 1: 'Le cœur de réseau achemine le trafic vers les autres opérateurs. La réponse peut revenir par un autre chemin.', 2: 'Cœur MPLS/IP redondant ; échanges de routes BGP avec les fournisseurs de transit et aux points d’échange Internet (IXP).' },
        },
    ],
};

export const architectures = [homeArchitecture, enterpriseArchitecture, campusArchitecture, operatorArchitecture];
