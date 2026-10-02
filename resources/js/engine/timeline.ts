import type { PacketMotion, Scenario, ScenarioStep } from './types';

export const DEFAULT_HOP = 0.9;
const AFTER_GAP = 0.25;

export type TimedPacket = PacketMotion & { start: number; end: number; hops: number };

export type StepTimeline = {
    packets: TimedPacket[];
    /** Fin de la dernière animation de paquet. */
    motionEnd: number;
    /** Durée totale de l'étape en lecture automatique (animation + lecture). */
    duration: number;
};

/** Temps de lecture estimé pour un texte (en secondes, vitesse normale). */
export function readingTime(text: string): number {
    return Math.min(9, Math.max(2.8, text.length * 0.042));
}

export function computeTimeline(step: ScenarioStep, text: string): StepTimeline {
    const byId = new Map<string, TimedPacket>();
    const timed: TimedPacket[] = [];

    for (const packet of step.packets) {
        const hops = Math.max(1, packet.path.length - 1);
        const hopDuration = packet.hop ?? DEFAULT_HOP;
        let start = packet.delay ?? 0;
        if (packet.after) {
            const previous = byId.get(packet.after);
            if (previous) start = previous.end + AFTER_GAP + (packet.delay ?? 0);
        }
        const entry: TimedPacket = { ...packet, start, end: start + hops * hopDuration, hops };
        byId.set(packet.id, entry);
        timed.push(entry);
    }

    const motionEnd = timed.reduce((max, p) => Math.max(max, p.end), 0);
    return { packets: timed, motionEnd, duration: motionEnd + readingTime(text) };
}

export type Point = { x: number; y: number };

function ease(u: number): number {
    // Le paquet accélère, ralentit, puis marque une courte pause sur l'équipement.
    const moving = Math.min(1, u / 0.82);
    return moving < 0.5 ? 2 * moving * moving : 1 - Math.pow(-2 * moving + 2, 2) / 2;
}

/**
 * Position d'un paquet sur son chemin à l'instant t.
 * `discrete` (réduction des animations) : le paquet saute d'équipement en équipement.
 */
export function packetPosition(points: Point[], packet: TimedPacket, t: number, discrete = false): Point & { progress: number } {
    if (points.length === 0) return { x: 0, y: 0, progress: 0 };
    const span = packet.end - packet.start;
    const raw = span <= 0 ? 1 : (t - packet.start) / span;
    const progress = Math.min(1, Math.max(0, raw));
    const segments = points.length - 1;
    if (segments <= 0) return { ...points[0], progress };

    const scaled = progress * segments;
    const index = Math.min(segments - 1, Math.floor(scaled));
    let local = scaled - index;
    if (progress >= 1) local = 1;
    const eased = discrete ? (local >= 0.5 ? 1 : 0) : ease(local);
    const a = points[index];
    const b = points[index + 1];
    return { x: a.x + (b.x - a.x) * eased, y: a.y + (b.y - a.y) * eased, progress };
}

/** Transpose une scène paysage en scène portrait (petits écrans). */
export function transposePoint(point: Point, portrait: boolean): Point {
    return portrait ? { x: point.y, y: point.x } : point;
}

export function nodeIndex(scenario: Scenario): Map<string, Point> {
    return new Map(scenario.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
}
