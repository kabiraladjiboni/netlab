import type { PacketField, PacketLayer } from '@/engine/types';

/**
 * Fabriques d'en-têtes : elles garantissent que les mêmes champs sont
 * toujours présentés de la même façon, avec la même explication.
 */

type Changed<K extends string> = Partial<Record<K, boolean>>;

const f = (name: string, value: string, level: 2 | 3, explain?: string, changed?: boolean): PacketField => ({
    name,
    value,
    level,
    explain,
    changed,
});

export function ethernet(options: {
    src: string;
    dst: string;
    srcLabel?: string;
    dstLabel?: string;
    type: '0x0800' | '0x0806' | '0x86dd' | '0x8100';
    changed?: Changed<'src' | 'dst'>;
    note?: string;
}): PacketLayer {
    const typeName: Record<string, string> = { '0x0800': 'IPv4', '0x0806': 'ARP', '0x86dd': 'IPv6', '0x8100': '802.1Q (VLAN)' };
    return {
        name: 'Ethernet II',
        layer: 'link',
        note: options.note,
        fields: [
            f('MAC destination', `${options.dst}${options.dstLabel ? ` (${options.dstLabel})` : ''}`, 2, "Adresse physique du **prochain équipement** sur ce lien local, pas celle de la destination finale.", options.changed?.dst),
            f('MAC source', `${options.src}${options.srcLabel ? ` (${options.srcLabel})` : ''}`, 2, "Adresse physique de la carte réseau qui émet la trame sur ce lien.", options.changed?.src),
            f('EtherType', `${options.type} (${typeName[options.type]})`, 3, 'Indique quel protocole est transporté dans la trame.'),
        ],
    };
}

export function ipv4(options: {
    src: string;
    dst: string;
    ttl: number;
    protocol: 'TCP' | 'UDP' | 'ICMP';
    totalLength: number;
    id?: string;
    df?: boolean;
    changed?: Changed<'src' | 'dst' | 'ttl' | 'checksum'>;
    note?: string;
}): PacketLayer {
    const protoNumber = { TCP: 6, UDP: 17, ICMP: 1 }[options.protocol];
    return {
        name: 'IPv4',
        layer: 'network',
        note: options.note,
        fields: [
            f('IP source', options.src, 2, "Adresse de l'expéditeur, telle qu'elle apparaît **à cet endroit du trajet**.", options.changed?.src),
            f('IP destination', options.dst, 2, 'Adresse de la destination finale. Les routeurs se basent sur elle pour choisir le prochain saut.', options.changed?.dst),
            f('Protocole', `${protoNumber} (${options.protocol})`, 2, "Numéro du protocole transporté dans la partie « données » du paquet IP."),
            f('Version', '4', 3, 'IPv4.'),
            f("Longueur d'en-tête", '20 octets (IHL = 5)', 3, "En-tête IPv4 sans options."),
            f('Longueur totale', `${options.totalLength} octets`, 3, 'Taille du paquet IP complet (en-tête + données).'),
            f('Identification', options.id ?? '0x1c46', 3, 'Sert à regrouper les fragments si le paquet devait être fragmenté.'),
            f('Drapeaux', options.df === false ? '0x0 (aucun)' : '0x2 (DF : ne pas fragmenter)', 3, "DF demande aux routeurs de ne pas fragmenter ; s'il le faut, ils signalent le problème par ICMP."),
            f('TTL', String(options.ttl), 3, 'Durée de vie : chaque routeur la diminue de 1. À 0, le paquet est détruit (cela évite les boucles infinies).', options.changed?.ttl),
            f("Somme de contrôle d'en-tête", options.changed?.checksum ? 'recalculée' : 'calculée par l’émetteur', 3, 'Vérifie que l’en-tête n’a pas été corrompu. Elle est recalculée à chaque modification (TTL, NAT…).', options.changed?.checksum),
        ],
    };
}

export function tcp(options: {
    srcPort: number;
    dstPort: number;
    seq: string;
    ack: string;
    flags: string;
    window: number;
    headerLength: number;
    options?: string;
    payload?: string;
    changed?: Changed<'srcPort' | 'dstPort' | 'checksum'>;
    note?: string;
}): PacketLayer {
    return {
        name: 'TCP',
        layer: 'transport',
        note: options.note,
        fields: [
            f('Port source', String(options.srcPort), 2, "Identifie la conversation côté émetteur. Côté client, c'est un port « éphémère » choisi par le système.", options.changed?.srcPort),
            f('Port destination', `${options.dstPort}${options.dstPort === 443 ? ' (HTTPS)' : ''}`, 2, 'Identifie le service visé sur la machine de destination.', options.changed?.dstPort),
            f('Drapeaux', options.flags, 2, 'Indiquent le rôle du segment : SYN (ouvrir), ACK (accuser réception), FIN (fermer), RST (interrompre), PSH (transmettre sans attendre).'),
            f('Numéro de séquence', options.seq, 3, 'Position des données envoyées dans le flux. Wireshark affiche par défaut un numéro **relatif** (0 au départ).'),
            f("Numéro d'acquittement", options.ack, 3, "Prochain octet attendu de l'autre côté (significatif seulement si ACK est présent)."),
            f('Fenêtre', String(options.window), 3, "Quantité de données que l'émetteur accepte de recevoir avant d'envoyer un nouvel acquittement (avant mise à l'échelle)."),
            f("Longueur d'en-tête", `${options.headerLength} octets`, 3, '20 octets minimum, davantage avec des options.'),
            ...(options.options ? [f('Options', options.options, 3, 'Paramètres négociés à l’ouverture : MSS, mise à l’échelle de la fenêtre, SACK, horodatage.')] : []),
            f('Somme de contrôle', options.changed?.checksum ? 'recalculée' : 'calculée par l’émetteur', 3, 'Couvre l’en-tête TCP, les données et un « pseudo-en-tête » contenant les adresses IP : d’où son recalcul après NAT.', options.changed?.checksum),
            ...(options.payload ? [f('Données', options.payload, 2)] : []),
        ],
    };
}

export function udp(options: { srcPort: number; dstPort: number; length: number; changed?: Changed<'srcPort' | 'dstPort' | 'checksum'>; note?: string }): PacketLayer {
    return {
        name: 'UDP',
        layer: 'transport',
        note: options.note,
        fields: [
            f('Port source', String(options.srcPort), 2, 'Port choisi par l’émetteur.', options.changed?.srcPort),
            f('Port destination', String(options.dstPort), 2, 'Service visé (53 = DNS, 443 = QUIC/HTTP/3, 67/68 = DHCP…).', options.changed?.dstPort),
            f('Longueur', `${options.length} octets`, 3, 'En-tête UDP (8 octets) + données.'),
            f('Somme de contrôle', options.changed?.checksum ? 'recalculée' : 'calculée par l’émetteur', 3, 'Facultative en IPv4, obligatoire en IPv6.', options.changed?.checksum),
        ],
    };
}

export const relSeq = (relative: number, raw: number) => `${relative} (relatif) — brut : ${raw}`;
