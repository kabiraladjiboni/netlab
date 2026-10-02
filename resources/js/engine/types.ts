/**
 * Moteur d'animation pédagogique — types des scénarios.
 *
 * Un scénario est une DESCRIPTION DÉTERMINISTE d'un échange réseau :
 * acteurs, liens, étapes, paquets animés et explications par niveau.
 * Ce n'est PAS une simulation : rien n'est calculé à partir d'un vrai réseau.
 * Toutes les valeurs (adresses, ports, numéros de séquence…) sont choisies
 * pour être cohérentes entre elles et sont documentées dans `assumptions`.
 */

import type { Level } from '@/hooks/use-preferences';

/** Texte adapté au niveau. Si un niveau manque, on utilise le niveau inférieur. */
export type LevelText = string | { 1: string; 2?: string; 3?: string };

export type NodeKind =
    | 'laptop'
    | 'desktop'
    | 'phone'
    | 'box'
    | 'router'
    | 'switch'
    | 'server'
    | 'dns'
    | 'firewall'
    | 'ap'
    | 'cloud'
    | 'ont'
    | 'tower'
    | 'iot'
    | 'loadbalancer';

export type Fact = {
    label: string;
    value: string;
    /** Niveau minimum auquel l'information est montrée (1 par défaut). */
    level?: Level;
    hint?: string;
};

export type SceneNode = {
    id: string;
    kind: NodeKind;
    label: string;
    /** Petite ligne technique sous le nom (adresse IP, rôle…). */
    sublabel?: string;
    x: number;
    y: number;
    description: LevelText;
    facts?: Fact[];
    /** Terme du dictionnaire associé (slug). */
    term?: string;
};

export type ZoneTone = 'home' | 'isp' | 'internet' | 'datacenter' | 'lan' | 'vlan-a' | 'vlan-b' | 'dns';

export type SceneZone = {
    id: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    tone: ZoneTone;
};

export type LinkMedium = 'ethernet' | 'wifi' | 'fiber' | 'wan' | 'trunk' | 'logical' | 'radio';

export type SceneLink = {
    from: string;
    to: string;
    medium?: LinkMedium;
    label?: string;
};

export type PacketTone = 'request' | 'response' | 'control' | 'secure' | 'broadcast' | 'error';

export type PacketMotion = {
    id: string;
    /** Texte court affiché sur le jeton (ex. « SYN », « DNS ? »). */
    label: string;
    tone: PacketTone;
    /** Suite d'identifiants de nœuds traversés (au moins 2). */
    path: string[];
    /** Départ en secondes depuis le début de l'étape (vitesse normale). */
    delay?: number;
    /** Démarre lorsque le paquet indiqué est arrivé (prioritaire sur delay). */
    after?: string;
    /** Durée d'un saut en secondes (0,9 s par défaut). */
    hop?: number;
    /** Identifiant d'un `PacketDetails` à ouvrir au clic. */
    inspect?: string;
    /** Le paquet est perdu / bloqué au dernier nœud du chemin. */
    lost?: boolean;
};

export type FieldLayer = 'link' | 'network' | 'transport' | 'security' | 'app';

export type PacketField = {
    name: string;
    value: string;
    explain?: string;
    /** 2 = visible dès « Je comprends », 3 = « J'approfondis ». */
    level: 2 | 3;
    /** Le champ a été modifié par rapport au saut précédent. */
    changed?: boolean;
};

export type PacketLayer = {
    name: string;
    layer: FieldLayer;
    fields: PacketField[];
    note?: string;
};

export type PacketDetails = {
    id: string;
    title: string;
    protocol: string;
    /** Taille illustrative de la trame en octets, si pertinente. */
    size?: string;
    where: string;
    beginner: { who: string; to: string; why: string; next: string };
    layers: PacketLayer[];
    note?: string;
};

export type TransformView = {
    title: string;
    caption: string;
    device: string;
    before: { label: string; value: string }[];
    after: { label: string; value: string }[];
    disclaimer?: string;
};

export type TableView = {
    title: string;
    caption?: string;
    columns: string[];
    rows: string[][];
    /** Index de la ligne mise en évidence (nouvelle ou utilisée). */
    highlight?: number;
    highlightKind?: 'new' | 'used';
};

export type StepStatus = 'info' | 'ok' | 'warning' | 'error';

export type Bubble = {
    node: string;
    text: string;
    tone?: 'info' | 'ok' | 'warning' | 'error';
    /** Position de la bulle par rapport au nœud. */
    side?: 'top' | 'bottom';
};

export type ScenarioStep = {
    id: string;
    title: string;
    /** Une seule idée importante par étape. */
    text: LevelText;
    focus: string[];
    packets: PacketMotion[];
    /** Paquet principal de l'étape (ouvert par « Détails techniques »). */
    details?: string;
    transform?: TransformView;
    table?: TableView;
    bubble?: Bubble;
    status?: StepStatus;
    /** Simplification pédagogique à signaler explicitement. */
    simplification?: string;
    /** Termes du dictionnaire liés à l'étape. */
    terms?: string[];
};

export type Scenario = {
    id: string;
    title: string;
    summary: string;
    /** Hypothèses et simplifications du scénario (toujours affichées). */
    assumptions: string[];
    viewBox: { w: number; h: number };
    zones?: SceneZone[];
    nodes: SceneNode[];
    links: SceneLink[];
    packets: Record<string, PacketDetails>;
    steps: ScenarioStep[];
};

export type ScenarioVariant = {
    id: string;
    label: string;
    description: string;
    status?: StepStatus;
    scenario: Scenario;
};

export function textFor(text: LevelText | undefined, level: Level): string {
    if (text === undefined) return '';
    if (typeof text === 'string') return text;
    if (level === 3) return text[3] ?? text[2] ?? text[1];
    if (level === 2) return text[2] ?? text[1];
    return text[1];
}
