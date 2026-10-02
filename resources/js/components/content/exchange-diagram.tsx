import { motion } from 'motion/react';
import { ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { renderInline } from '@/components/content/rich-text';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

export type ExchangeMessage = { from: string; to: string; message: string; note?: string };

type ParsedMessage = { a: number; b: number; both: boolean; text: string; note?: string };

/**
 * Diagramme de séquence animé, généré automatiquement à partir des données
 * « communication » d'une fiche protocole : aucun composant spécifique par
 * protocole n'est nécessaire.
 */
export function ExchangeDiagram({ messages, title }: { messages: ExchangeMessage[]; title: string }) {
    const { reducedMotion } = usePreferences();
    const { actors, rows } = useMemo(() => parse(messages), [messages]);
    const [visible, setVisible] = useState(reducedMotion ? rows.length : 0);
    const [playing, setPlaying] = useState(!reducedMotion);

    useEffect(() => {
        if (!playing) return;
        if (visible >= rows.length) {
            setPlaying(false);
            return;
        }
        const timer = window.setTimeout(() => setVisible((value) => value + 1), visible === 0 ? 300 : 1500);
        return () => window.clearTimeout(timer);
    }, [playing, visible, rows.length]);

    const columns = actors.length;

    return (
        <figure className="rounded-2xl border border-line bg-night-900/50 p-4 sm:p-5" aria-label={`Diagramme d'échange : ${title}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <figcaption className="text-sm font-medium">{title}</figcaption>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            if (visible >= rows.length) setVisible(0);
                            setPlaying((value) => !value);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-night-700"
                    >
                        {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                        {playing ? 'Pause' : 'Lecture'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setPlaying(false);
                            setVisible((value) => Math.min(rows.length, value + 1));
                        }}
                        disabled={visible >= rows.length}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-night-700 disabled:opacity-40"
                    >
                        Étape <ChevronRight className="size-3.5" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setVisible(0);
                            setPlaying(true);
                        }}
                        className="rounded-lg p-1.5 hover:bg-night-700"
                        aria-label="Rejouer l'échange"
                    >
                        <RotateCcw className="size-3.5" aria-hidden />
                    </button>
                </div>
            </div>

            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {actors.map((actor) => (
                    <div key={actor} className="rounded-xl border border-signal/30 bg-signal/10 px-2 py-2 text-center text-xs font-semibold sm:text-sm">
                        {actor}
                    </div>
                ))}
            </div>

            <ol className="relative mt-2">
                <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden>
                    {actors.map((actor) => (
                        <div key={actor} className="mx-auto w-px bg-gradient-to-b from-signal/40 to-transparent" />
                    ))}
                </div>
                {rows.map((row, index) => {
                    const left = Math.min(row.a, row.b);
                    const right = Math.max(row.a, row.b);
                    const self = left === right;
                    const start = ((left + 0.5) / columns) * 100;
                    const width = self ? 0 : ((right - left) / columns) * 100;
                    const towardsRight = row.b >= row.a;
                    const shown = index < visible;
                    return (
                        <li key={index} className={cn('relative py-3 transition-opacity', shown ? 'opacity-100' : 'opacity-0')} aria-hidden={!shown}>
                            <div className={cn('relative mx-auto mb-1.5 rounded-lg bg-night-850/90 px-2 py-1 text-center text-[13px] leading-snug', self ? 'max-w-[70%]' : '')}
                                style={self ? undefined : { marginLeft: `${start}%`, width: `${Math.max(width, 30)}%` }}
                            >
                                <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{index + 1}.</span>
                                {renderInline(row.text)}
                            </div>
                            {!self && (
                                <div className="relative h-3">
                                    <motion.div
                                        className={cn('absolute top-1/2 h-0.5 -translate-y-1/2', row.both ? 'bg-violet' : towardsRight ? 'bg-signal' : 'bg-ok')}
                                        style={{ left: `${start}%`, width: `${width}%`, transformOrigin: towardsRight ? 'left' : 'right' }}
                                        initial={false}
                                        animate={{ scaleX: shown ? 1 : 0 }}
                                        transition={{ duration: reducedMotion ? 0 : 0.6, ease: 'easeOut' }}
                                    />
                                    {(towardsRight || row.both) && (
                                        <span className={cn('absolute top-1/2 size-0 -translate-y-1/2 border-y-[6px] border-l-[9px] border-y-transparent', row.both ? 'border-l-violet' : 'border-l-signal')} style={{ left: `calc(${start + width}% - 8px)` }} />
                                    )}
                                    {(!towardsRight || row.both) && (
                                        <span className={cn('absolute top-1/2 size-0 -translate-y-1/2 border-y-[6px] border-r-[9px] border-y-transparent', row.both ? 'border-r-violet' : 'border-r-ok')} style={{ left: `${start}%` }} />
                                    )}
                                </div>
                            )}
                            {row.note && shown && <p className="mx-auto mt-1.5 max-w-xl text-center text-xs text-muted-foreground">{renderInline(row.note)}</p>}
                        </li>
                    );
                })}
            </ol>
            <p className="sr-only">
                {rows.map((row, index) => `${index + 1}. ${actors[row.a]} vers ${actors[row.b]} : ${row.text}.`).join(' ')}
            </p>
        </figure>
    );
}

function parse(messages: ExchangeMessage[]): { actors: string[]; rows: ParsedMessage[] } {
    const actors: string[] = [];
    const indexOf = (name: string) => {
        const clean = name.trim();
        let index = actors.indexOf(clean);
        if (index === -1) {
            actors.push(clean);
            index = actors.length - 1;
        }
        return index;
    };
    const rows = messages.map((message) => {
        if (message.from.includes('↔')) {
            const [left, right] = message.from.split('↔');
            return { a: indexOf(left), b: indexOf(right), both: true, text: message.message, note: message.note };
        }
        const a = indexOf(message.from);
        const b = message.to.trim() ? indexOf(message.to) : a;
        return { a, b, both: false, text: message.message, note: message.note };
    });
    return { actors, rows };
}
