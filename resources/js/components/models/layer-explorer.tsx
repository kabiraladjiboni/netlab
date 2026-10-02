import { Link } from '@inertiajs/react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp, Cpu, Info, Package, Puzzle, Target } from 'lucide-react';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';
import { osiLayerColor, tcpipLayerColor } from '@/lib/labels';
import type { LayerInfo } from '@/types/content';

/** Tour de couches cliquable + panneau de détails (utilisée par OSI et TCP/IP). */
export function LayerExplorer({
    layers,
    selected,
    onSelect,
    highlight = [],
    direction,
}: {
    layers: LayerInfo[];
    selected: number;
    onSelect: (layer: number) => void;
    highlight?: number[];
    direction?: 'down' | 'up' | null;
}) {
    const { reducedMotion, level } = usePreferences();
    const model = layers[0]?.model ?? 'osi';
    const color = model === 'osi' ? osiLayerColor : tcpipLayerColor;
    const ordered = [...layers].sort((a, b) => b.number - a.number);
    const current = layers.find((layer) => layer.number === selected) ?? layers[0];

    return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <div className="relative">
                <div role="tablist" aria-orientation="vertical" aria-label={`Couches du modèle ${model === 'osi' ? 'OSI' : 'TCP/IP'}`} className="flex flex-col gap-2">
                    {ordered.map((layer) => {
                        const active = layer.number === selected;
                        const lit = highlight.includes(layer.number);
                        return (
                            <motion.button
                                key={layer.slug}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                aria-controls="layer-panel"
                                id={`layer-tab-${layer.number}`}
                                onClick={() => onSelect(layer.number)}
                                onKeyDown={(event) => {
                                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                        event.preventDefault();
                                        const next = event.key === 'ArrowUp' ? layer.number + 1 : layer.number - 1;
                                        if (layers.some((l) => l.number === next)) {
                                            onSelect(next);
                                            document.getElementById(`layer-tab-${next}`)?.focus();
                                        }
                                    }
                                }}
                                tabIndex={active ? 0 : -1}
                                animate={{ scale: active && !reducedMotion ? 1.02 : 1 }}
                                className={cn(
                                    'group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors',
                                    model === 'tcpip' && layer.number === 4 && 'py-6',
                                    model === 'tcpip' && layer.number === 1 && 'py-5',
                                    active ? 'border-signal bg-signal/12 shadow-lg shadow-electric/10' : 'border-line bg-surface hover:border-signal/40',
                                    lit && !active && 'border-warn/60 bg-warn/8',
                                )}
                            >
                                <span className={cn('absolute inset-y-0 left-0 w-1.5', color(layer.number))} aria-hidden />
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-night-700 font-mono text-sm font-semibold">{layer.number}</span>
                                <span className="min-w-0">
                                    <span className="block font-semibold">{layer.name}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {layer.english}
                                        {layer.pdu ? ` · ${layer.pdu}` : ''}
                                    </span>
                                </span>
                                {active && !reducedMotion && <motion.span layoutId={`active-${model}`} className="absolute inset-0 rounded-2xl ring-1 ring-signal/60" aria-hidden />}
                            </motion.button>
                        );
                    })}
                </div>
                {direction && (
                    <div className={cn('pointer-events-none absolute top-0 -right-3 bottom-0 hidden w-6 flex-col items-center justify-center sm:flex', direction === 'down' ? 'text-signal' : 'text-ok')} aria-hidden>
                        {direction === 'down' ? <ArrowDown className="size-5 animate-bounce" /> : <ArrowUp className="size-5 animate-bounce" />}
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                <motion.article
                    key={current.slug}
                    id="layer-panel"
                    role="tabpanel"
                    aria-labelledby={`layer-tab-${current.number}`}
                    initial={reducedMotion ? false : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: -10 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-3xl border border-line bg-surface p-5 sm:p-7"
                >
                    <p className="text-xs font-semibold tracking-[0.18em] text-signal uppercase">
                        Couche {current.number} — {model === 'osi' ? 'OSI' : 'TCP/IP'}
                    </p>
                    <h2 className="mt-2 font-display text-3xl font-semibold">{current.name}</h2>
                    <p className="mt-3 text-lg leading-relaxed">{current.role}</p>

                    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                                <Target className="size-4 text-signal" aria-hidden /> Le problème qu’elle résout
                            </h3>
                            <p className="mt-1.5 text-sm text-foreground/85">{current.problem}</p>
                        </div>
                        <div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                                <Package className="size-4 text-signal" aria-hidden /> Exemples concrets
                            </h3>
                            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground/85">
                                {current.examples.map((example) => (
                                    <li key={example}>{example}</li>
                                ))}
                            </ul>
                        </div>
                        {current.devices.length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-semibold">
                                    <Cpu className="size-4 text-signal" aria-hidden /> Équipements ou fonctions
                                </h3>
                                <p className="mt-1.5 text-sm text-foreground/85">{current.devices.join(', ')}</p>
                            </div>
                        )}
                        <div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                                <Puzzle className="size-4 text-signal" aria-hidden /> Avec les couches voisines
                            </h3>
                            <p className="mt-1.5 text-sm text-foreground/85">{current.neighbors}</p>
                        </div>
                    </div>

                    {current.pdu && (
                        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-night-700 px-3 py-1 text-sm">
                            Unité de données : <strong>{current.pdu}</strong>
                        </p>
                    )}

                    {current.protocols.length > 0 && (
                        <div className="mt-5">
                            <h3 className="text-sm font-semibold">Protocoles et normes du catalogue</h3>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {current.protocols.slice(0, level === 1 ? 10 : 40).map((protocol) => (
                                    <Link key={protocol.slug} href={`/protocoles/${protocol.slug}`} className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs hover:border-signal/60 hover:text-signal">
                                        {protocol.acronym}
                                    </Link>
                                ))}
                                {level === 1 && current.protocols.length > 10 && <span className="px-1 text-xs text-muted-foreground">et {current.protocols.length - 10} autres…</span>}
                            </div>
                        </div>
                    )}

                    {current.note && (
                        <p className="mt-5 flex gap-2 rounded-2xl border border-line bg-night-900/50 p-3 text-sm text-muted-foreground">
                            <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                            {current.note}
                        </p>
                    )}
                </motion.article>
            </AnimatePresence>
        </div>
    );
}
