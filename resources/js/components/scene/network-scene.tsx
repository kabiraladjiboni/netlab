import { AnimatePresence, motion, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useMemo } from 'react';
import { packetPosition, transposePoint } from '@/engine/timeline';
import type { Point, StepTimeline, TimedPacket } from '@/engine/timeline';
import type { PacketTone, Scenario, SceneLink, SceneNode, SceneZone, ScenarioStep } from '@/engine/types';
import { cn } from '@/lib/utils';
import { DeviceIcon } from './device-icon';

export const toneColor: Record<PacketTone, string> = {
    request: 'var(--color-signal)',
    response: 'var(--color-ok)',
    control: 'var(--color-electric)',
    secure: 'var(--color-violet)',
    broadcast: 'var(--color-warn)',
    error: 'var(--color-danger)',
};

const zoneFill: Record<SceneZone['tone'], string> = {
    home: 'color-mix(in oklab, var(--color-electric) 7%, transparent)',
    isp: 'color-mix(in oklab, var(--color-warn) 6%, transparent)',
    internet: 'color-mix(in oklab, var(--color-signal) 5%, transparent)',
    datacenter: 'color-mix(in oklab, var(--color-ok) 6%, transparent)',
    lan: 'color-mix(in oklab, var(--color-electric) 7%, transparent)',
    'vlan-a': 'color-mix(in oklab, var(--color-layer-transport) 9%, transparent)',
    'vlan-b': 'color-mix(in oklab, var(--color-layer-app) 9%, transparent)',
    dns: 'color-mix(in oklab, var(--color-violet) 6%, transparent)',
};

const zoneStroke: Record<SceneZone['tone'], string> = {
    home: 'color-mix(in oklab, var(--color-electric) 45%, transparent)',
    isp: 'color-mix(in oklab, var(--color-warn) 40%, transparent)',
    internet: 'color-mix(in oklab, var(--color-signal) 35%, transparent)',
    datacenter: 'color-mix(in oklab, var(--color-ok) 40%, transparent)',
    lan: 'color-mix(in oklab, var(--color-electric) 45%, transparent)',
    'vlan-a': 'color-mix(in oklab, var(--color-layer-transport) 55%, transparent)',
    'vlan-b': 'color-mix(in oklab, var(--color-layer-app) 55%, transparent)',
    dns: 'color-mix(in oklab, var(--color-violet) 40%, transparent)',
};

type SceneProps = {
    scenario: Scenario;
    step: ScenarioStep;
    timeline: StepTimeline;
    time: MotionValue<number>;
    portrait: boolean;
    reducedMotion: boolean;
    selectedNode: string | null;
    selectedPacket: string | null;
    onSelectNode: (id: string) => void;
    onSelectPacket: (packet: TimedPacket) => void;
    className?: string;
};

export function NetworkScene({
    scenario,
    step,
    timeline,
    time,
    portrait,
    reducedMotion,
    selectedNode,
    selectedPacket,
    onSelectNode,
    onSelectPacket,
    className,
}: SceneProps) {
    const width = portrait ? scenario.viewBox.h : scenario.viewBox.w;
    const height = portrait ? scenario.viewBox.w : scenario.viewBox.h;

    const points = useMemo(() => {
        const map = new Map<string, Point>();
        for (const node of scenario.nodes) map.set(node.id, transposePoint(node, portrait));
        return map;
    }, [scenario.nodes, portrait]);

    const activeLinks = useMemo(() => {
        const set = new Set<string>();
        for (const packet of step.packets) {
            for (let i = 1; i < packet.path.length; i += 1) set.add([packet.path[i - 1], packet.path[i]].sort().join('|'));
        }
        return set;
    }, [step.packets]);

    const focus = new Set(step.focus);
    const bubbleNode = step.bubble ? points.get(step.bubble.node) : undefined;

    return (
        <div className={cn('relative w-full', className)}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="block h-auto w-full select-none"
                role="group"
                aria-label={`Schéma animé : ${scenario.title}. Étape : ${step.title}.`}
            >
                <defs>
                    <filter id="packet-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <radialGradient id="node-halo">
                        <stop offset="0%" stopColor="color-mix(in oklab, var(--color-signal) 45%, transparent)" />
                        <stop offset="100%" stopColor="color-mix(in oklab, var(--color-signal) 0%, transparent)" />
                    </radialGradient>
                </defs>

                {scenario.zones?.map((zone) => <Zone key={zone.id} zone={zone} portrait={portrait} />)}

                {scenario.links.map((link) => {
                    const a = points.get(link.from);
                    const b = points.get(link.to);
                    if (!a || !b) return null;
                    const active = activeLinks.has([link.from, link.to].sort().join('|'));
                    return <Link key={`${link.from}-${link.to}`} link={link} a={a} b={b} active={active} reducedMotion={reducedMotion} />;
                })}

                {scenario.nodes.map((node) => {
                    const point = points.get(node.id)!;
                    return (
                        <Node
                            key={node.id}
                            node={node}
                            point={point}
                            focused={focus.has(node.id)}
                            dimmed={focus.size > 0}
                            selected={selectedNode === node.id}
                            reducedMotion={reducedMotion}
                            onSelect={() => onSelectNode(node.id)}
                        />
                    );
                })}

                {timeline.packets.map((packet) => (
                    <PacketToken
                        key={`${step.id}-${packet.id}`}
                        packet={packet}
                        points={packet.path.map((id) => points.get(id)!).filter(Boolean)}
                        time={time}
                        discrete={reducedMotion}
                        selected={selectedPacket === packet.id}
                        onSelect={() => onSelectPacket(packet)}
                    />
                ))}
            </svg>

            <AnimatePresence mode="wait">
                {step.bubble && bubbleNode && (
                    <div
                        key={`${step.id}-bubble`}
                        className="pointer-events-none absolute z-10"
                        style={
                            portrait
                                ? { left: '50%', top: '0.25rem', transform: 'translateX(-50%)' }
                                : {
                                      left: `${(bubbleNode.x / width) * 100}%`,
                                      top: `${(bubbleNode.y / height) * 100}%`,
                                      // Près des bords, la bulle s'aligne vers l'intérieur au lieu d'être coupée.
                                      transform: `translate(${bubbleNode.x / width < 0.22 ? '-14%' : bubbleNode.x / width > 0.78 ? '-86%' : '-50%'}, ${step.bubble.side === 'bottom' ? '3.4rem' : 'calc(-100% - 2.6rem)'})`,
                                  }
                        }
                    >
                        <motion.div
                            initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35 }}
                            className={cn(
                                'w-max max-w-[min(15rem,42vw)] rounded-xl border px-3 py-2 text-xs leading-snug shadow-lg shadow-[var(--shadow-color)] sm:text-[13px]',
                                step.bubble.tone === 'error' && 'border-danger/60 bg-night-900/95 text-danger',
                                step.bubble.tone === 'warning' && 'border-warn/60 bg-night-900/95 text-warn',
                                step.bubble.tone === 'ok' && 'border-ok/60 bg-night-900/95 text-ok',
                                (!step.bubble.tone || step.bubble.tone === 'info') && 'border-signal/50 bg-night-900/95 text-foreground',
                            )}
                            role="status"
                        >
                            {step.bubble.text}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Zone({ zone, portrait }: { zone: SceneZone; portrait: boolean }) {
    const x = portrait ? zone.y : zone.x;
    const y = portrait ? zone.x : zone.y;
    const w = portrait ? zone.h : zone.w;
    const h = portrait ? zone.w : zone.h;
    return (
        <g aria-hidden="true">
            <rect x={x} y={y} width={w} height={h} rx={22} fill={zoneFill[zone.tone]} stroke={zoneStroke[zone.tone]} strokeDasharray="6 6" strokeWidth={1.4} />
            <text x={x + 16} y={y + 24} fontSize={13} fontWeight={600} letterSpacing={1.2} fill={zoneStroke[zone.tone].replace(/ \d+%, transparent\)/, ' 90%, transparent)')} style={{ textTransform: 'uppercase' }}>
                {zone.label}
            </text>
        </g>
    );
}

function Link({ link, a, b, active, reducedMotion }: { link: SceneLink; a: Point; b: Point; active: boolean; reducedMotion: boolean }) {
    const medium = link.medium ?? 'ethernet';
    const base =
        medium === 'fiber'
            ? 'color-mix(in oklab, var(--color-warn) 55%, transparent)'
            : medium === 'logical'
              ? 'var(--scene-link-dim)'
              : 'var(--scene-link)';
    const dash = medium === 'wifi' || medium === 'radio' ? '3 7' : medium === 'logical' ? '2 8' : medium === 'wan' ? '10 6' : undefined;
    const width = medium === 'trunk' ? 5 : 2.4;
    return (
        <g aria-hidden="true">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={base} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
            {active && (
                <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--color-signal)"
                    strokeOpacity={0.55}
                    strokeWidth={width + 1}
                    strokeDasharray="4 8"
                    strokeLinecap="round"
                    className={reducedMotion ? undefined : 'animate-dash'}
                />
            )}
            {link.label && (
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10} textAnchor="middle" fontSize={11} fill="var(--color-muted-foreground)" fontFamily="var(--font-mono)">
                    {link.label}
                </text>
            )}
        </g>
    );
}

function Node({
    node,
    point,
    focused,
    dimmed,
    selected,
    reducedMotion,
    onSelect,
}: {
    node: SceneNode;
    point: Point;
    focused: boolean;
    dimmed: boolean;
    selected: boolean;
    reducedMotion: boolean;
    onSelect: () => void;
}) {
    return (
        <g
            transform={`translate(${point.x} ${point.y})`}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${node.label}${node.sublabel ? ` (${node.sublabel})` : ''} — afficher le rôle de cet équipement`}
            className="cursor-pointer outline-none [&:focus-visible_.node-ring]:opacity-100"
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
        >
            <circle r={48} fill="url(#node-halo)" opacity={focused ? 1 : 0} style={{ transition: 'opacity 400ms' }} />
            {focused && !reducedMotion && (
                <circle r={40} fill="none" stroke="var(--color-signal)" strokeWidth={1.5} className="origin-center animate-pulse-ring" style={{ transformBox: 'fill-box' }} />
            )}
            <circle
                r={42}
                fill="none"
                stroke="var(--color-signal)"
                strokeWidth={2}
                strokeDasharray="5 5"
                className="node-ring"
                opacity={selected ? 1 : 0}
            />
            <rect x={-42} y={-42} width={84} height={84} fill="transparent" />
            <g style={{ opacity: focused ? 1 : dimmed ? 0.42 : 0.78, transition: 'opacity 400ms' }}>
                <DeviceIcon kind={node.kind} />
            </g>
            <text y={54} textAnchor="middle" fontSize={17} fontWeight={600} fill="var(--scene-label)" className="font-display">
                {node.label}
            </text>
            {node.sublabel?.split('\n').map((line, index) => (
                <text key={line} y={72 + index * 16} textAnchor="middle" fontSize={13} fill="var(--scene-sublabel)" fontFamily="var(--font-mono)">
                    {line}
                </text>
            ))}
        </g>
    );
}

function PacketToken({
    packet,
    points,
    time,
    discrete,
    selected,
    onSelect,
}: {
    packet: TimedPacket;
    points: Point[];
    time: MotionValue<number>;
    discrete: boolean;
    selected: boolean;
    onSelect: () => void;
}) {
    const x = useTransform(time, (t) => packetPosition(points, packet, t, discrete).x);
    const y = useTransform(time, (t) => packetPosition(points, packet, t, discrete).y);
    const opacity = useTransform(time, (t) => {
        if (t < packet.start) return 0;
        if (packet.lost && t > packet.end + 0.5) return 0.45;
        return 1;
    });
    const lostMark = useTransform(time, (t) => (packet.lost && t >= packet.end ? 1 : 0));
    const color = toneColor[packet.tone];
    const width = Math.max(44, packet.label.length * 8.4 + 22);

    return (
        <motion.g style={{ x, y, opacity }} onClick={onSelect} className="cursor-pointer" aria-hidden="true">
            <rect x={-width / 2} y={-14} width={width} height={28} rx={14} fill="var(--scene-packet-bg)" stroke={color} strokeWidth={selected ? 3 : 2} filter="url(#packet-glow)" />
            <text y={4.5} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={color} fontFamily="var(--font-mono)">
                {packet.label}
            </text>
            <motion.g style={{ opacity: lostMark }}>
                <circle cx={width / 2} cy={-14} r={9} fill="var(--color-danger)" />
                <path d={`M${width / 2 - 4} -18 l8 8 M${width / 2 + 4} -18 l-8 8`} stroke="var(--scene-packet-bg)" strokeWidth={2.2} strokeLinecap="round" />
            </motion.g>
        </motion.g>
    );
}
