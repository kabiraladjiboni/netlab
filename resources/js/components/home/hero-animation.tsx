import { motion } from 'motion/react';
import { DeviceIcon } from '@/components/scene/device-icon';
import type { NodeKind } from '@/engine/types';
import { usePreferences } from '@/hooks/use-preferences';

type HeroNode = { id: string; kind: NodeKind; label: string; x: number; y: number };

const nodes: HeroNode[] = [
    { id: 'pc', kind: 'laptop', label: 'Ordinateur', x: 70, y: 260 },
    { id: 'box', kind: 'box', label: 'Box', x: 205, y: 260 },
    { id: 'r1', kind: 'router', label: 'Routeur', x: 330, y: 160 },
    { id: 'r2', kind: 'router', label: 'Routeur', x: 440, y: 290 },
    { id: 'srv', kind: 'server', label: 'Serveur', x: 560, y: 175 },
];
const route = ['pc', 'box', 'r1', 'r2', 'srv'];
const at = (id: string) => nodes.find((node) => node.id === id)!;

/** Animation légère de la page d'accueil : un paquet aller, une réponse retour. */
export function HeroAnimation() {
    const { reducedMotion } = usePreferences();
    const forward = route.map(at);
    const backward = [...forward].reverse();
    const times = forward.map((_, index) => index / (forward.length - 1));

    return (
        <div className="relative">
            <div className="absolute inset-6 rounded-full bg-electric/20 blur-3xl" aria-hidden />
            <svg viewBox="0 0 630 380" className="relative h-auto w-full" role="img" aria-label="Animation : un paquet part d'un ordinateur, traverse la box et deux routeurs jusqu'à un serveur, puis la réponse revient.">
                <defs>
                    <filter id="hero-glow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="5" result="b" />
                        <feMerge>
                            <feMergeNode in="b" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <rect x="20" y="185" width="245" height="150" rx="22" fill="color-mix(in oklab, var(--color-electric) 8%, transparent)" stroke="color-mix(in oklab, var(--color-electric) 40%, transparent)" strokeDasharray="6 6" />
                <text x="36" y="207" fontSize="12" fontWeight="600" letterSpacing="1.2" fill="var(--color-layer-network)">MAISON</text>
                <rect x="280" y="95" width="335" height="260" rx="22" fill="color-mix(in oklab, var(--color-signal) 5%, transparent)" stroke="color-mix(in oklab, var(--color-signal) 30%, transparent)" strokeDasharray="6 6" />
                <text x="296" y="117" fontSize="12" fontWeight="600" letterSpacing="1.2" fill="var(--color-signal)">INTERNET</text>

                {route.slice(1).map((id, index) => {
                    const a = at(route[index]);
                    const b = at(id);
                    return (
                        <g key={id}>
                            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--scene-link)" strokeWidth="2.4" strokeLinecap="round" />
                            <line
                                x1={a.x}
                                y1={a.y}
                                x2={b.x}
                                y2={b.y}
                                stroke="var(--color-signal)"
                                strokeOpacity="0.45"
                                strokeWidth="3"
                                strokeDasharray="4 8"
                                strokeLinecap="round"
                                className={reducedMotion ? undefined : 'animate-dash'}
                            />
                        </g>
                    );
                })}

                {nodes.map((node) => (
                    <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                        <DeviceIcon kind={node.kind} />
                        <text y="52" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--scene-label)">
                            {node.label}
                        </text>
                    </g>
                ))}

                {reducedMotion ? (
                    <g transform={`translate(${(at('box').x + at('r1').x) / 2} ${(at('box').y + at('r1').y) / 2})`}>
                        <rect x="-26" y="-13" width="52" height="26" rx="13" fill="var(--scene-packet-bg)" stroke="var(--color-signal)" strokeWidth="2" />
                        <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-signal)" fontFamily="var(--font-mono)">
                            GET
                        </text>
                    </g>
                ) : (
                    <>
                        <motion.g
                            initial={{ x: forward[0].x, y: forward[0].y, opacity: 0 }}
                            animate={{ x: forward.map((n) => n.x), y: forward.map((n) => n.y), opacity: [0, 1, 1, 1, 0] }}
                            transition={{ duration: 4.2, times, ease: 'easeInOut', repeat: Infinity, repeatDelay: 4.4 }}
                            filter="url(#hero-glow)"
                        >
                            <rect x="-26" y="-13" width="52" height="26" rx="13" fill="var(--scene-packet-bg)" stroke="var(--color-signal)" strokeWidth="2" />
                            <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-signal)" fontFamily="var(--font-mono)">
                                GET
                            </text>
                        </motion.g>
                        <motion.g
                            initial={{ x: backward[0].x, y: backward[0].y, opacity: 0 }}
                            animate={{ x: backward.map((n) => n.x), y: backward.map((n) => n.y), opacity: [0, 1, 1, 1, 0] }}
                            transition={{ duration: 4.2, times, ease: 'easeInOut', repeat: Infinity, repeatDelay: 4.4, delay: 4.4 }}
                            filter="url(#hero-glow)"
                        >
                            <rect x="-24" y="-13" width="48" height="26" rx="13" fill="var(--scene-packet-bg)" stroke="var(--color-ok)" strokeWidth="2" />
                            <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ok)" fontFamily="var(--font-mono)">
                                200
                            </text>
                        </motion.g>
                    </>
                )}
            </svg>
        </div>
    );
}
