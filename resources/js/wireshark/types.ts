/**
 * Modèle de données du parcours Wireshark.
 * Une « capture pédagogique » est construite à la main pour être cohérente ;
 * une « capture importée » provient d'un fichier PCAP/PCAPNG analysé dans le navigateur.
 */

export type TreeField = {
    label: string;
    /** Explication affichée en mode avancé. */
    explain?: string;
    /** Nom du champ de filtre Wireshark correspondant (ex. « tcp.flags.syn »). */
    filter?: string;
    children?: TreeField[];
};

export type TreeLayer = {
    title: string;
    kind: 'frame' | 'link' | 'network' | 'transport' | 'security' | 'app';
    fields: TreeField[];
};

export type RowColor = 'tcp' | 'syn' | 'rst' | 'dns' | 'arp' | 'icmp' | 'tls' | 'http' | 'dhcp' | 'udp' | 'bad' | 'quic' | 'other';

export type FieldValue = string | number | boolean;

export type CapturePacket = {
    no: number;
    time: number;
    src: string;
    dst: string;
    protocol: string;
    length: number;
    info: string;
    color: RowColor;
    tree: TreeLayer[];
    /** Valeurs utilisées par le moteur de filtres (clé = nom de champ Wireshark). */
    fields: Record<string, FieldValue[]>;
    /** Protocoles présents dans le paquet (pour les filtres « tcp », « dns »…). */
    protocols: string[];
    /** Explication en langage courant (mode débutant). */
    beginner?: string;
    /** Rôle du paquet dans l'échange. */
    role?: string;
    /** Lien vers l'étape correspondante d'une animation. */
    lesson?: { href: string; label: string };
    /** Contenu applicatif chiffré (TLS, QUIC). */
    encrypted?: boolean;
};

export type Mission = {
    id: string;
    prompt: string;
    kind: 'select' | 'filter';
    /** Numéros de paquets attendus. */
    answer: number[];
    hint: string;
    explanation: string;
};

export type Capture = {
    id: string;
    title: string;
    description: string;
    /** true : données construites pour l'apprentissage, pas un trafic réel. */
    pedagogical: boolean;
    packets: CapturePacket[];
    missions: Mission[];
};
