import { ArrowRight, Equal, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import type { TableView, TransformView } from '@/engine/types';
import { cn } from '@/lib/utils';

/**
 * Visualisation « avant / après » d'une transformation (traduction NAT/PAT).
 * Seuls les champs listés sont montrés ; les champs modifiés sont mis en évidence.
 */
export function TransformCard({ view, reducedMotion, playKey }: { view: TransformView; reducedMotion: boolean; playKey: string }) {
    const rows = view.before.map((before) => ({
        label: before.label,
        before: before.value,
        after: view.after.find((item) => item.label === before.label)?.value ?? before.value,
    }));

    return (
        <section className="overflow-hidden rounded-2xl border border-warn/35 bg-gradient-to-b from-warn/8 to-transparent" aria-label={view.title}>
            <header className="flex items-center gap-2 border-b border-warn/20 px-4 py-2.5">
                <RefreshCw className="size-4 text-warn" aria-hidden />
                <h3 className="font-sans text-sm font-semibold">{view.title}</h3>
                <span className="ml-auto text-[11px] text-muted-foreground">{view.device}</span>
            </header>
            <div className="p-3 sm:p-4">
                <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-end gap-2 text-[11px] font-semibold tracking-wide uppercase">
                    <span className="text-signal">Avant</span>
                    <span className="w-6" />
                    <span className="text-warn">Après</span>
                </div>
                <ul className="space-y-1.5">
                    {rows.map((row, index) => {
                        const changed = row.before !== row.after;
                        return (
                            <li key={`${playKey}-${row.label}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="min-w-0 rounded-lg border border-line bg-night-900/60 px-2.5 py-1.5">
                                    <p className="text-[10.5px] text-muted-foreground">{row.label}</p>
                                    <p className="font-mono text-[13px] break-all">{row.before}</p>
                                </div>
                                <span className="flex w-6 justify-center" aria-hidden>
                                    {changed ? <ArrowRight className="size-4 text-warn" /> : <Equal className="size-4 text-muted-foreground" />}
                                </span>
                                <motion.div
                                    initial={reducedMotion ? false : { opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: reducedMotion ? 0 : 0.4 + index * 0.35, duration: 0.45 }}
                                    className={cn(
                                        'min-w-0 rounded-lg border px-2.5 py-1.5',
                                        changed ? 'border-warn/60 bg-warn/10 shadow-[0_0_18px_-6px] shadow-warn/60' : 'border-line bg-night-900/60',
                                    )}
                                >
                                    <p className="text-[10.5px] text-muted-foreground">
                                        {row.label} {changed ? <span className="font-semibold text-warn">· traduit</span> : <span>· inchangé</span>}
                                    </p>
                                    <p className={cn('font-mono text-[13px] break-all', changed && 'text-warn')}>{row.after}</p>
                                </motion.div>
                            </li>
                        );
                    })}
                </ul>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/85">{view.caption}</p>
                {view.disclaimer && <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{view.disclaimer}</p>}
            </div>
        </section>
    );
}

/** Mémoire d'un équipement : table NAT, cache ARP, cache DNS, table de routage… */
export function MemoryTable({ table, reducedMotion }: { table: TableView; reducedMotion: boolean }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-line bg-night-900/50" aria-label={table.title}>
            <header className="border-b border-line px-4 py-2.5">
                <h3 className="font-sans text-sm font-semibold">{table.title}</h3>
                {table.caption && <p className="mt-0.5 text-xs text-muted-foreground">{table.caption}</p>}
            </header>
            <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-max text-left text-[12.5px]">
                    <thead>
                        <tr className="text-[11px] tracking-wide text-muted-foreground uppercase">
                            {table.columns.map((column) => (
                                <th key={column} scope="col" className="px-3 py-2 font-medium">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="font-mono">
                        {table.rows.map((row, index) => {
                            const highlighted = index === table.highlight;
                            return (
                                <motion.tr
                                    key={`${index}-${row.join('|')}`}
                                    initial={highlighted && !reducedMotion ? { backgroundColor: 'color-mix(in oklab, var(--color-warn) 35%, transparent)' } : false}
                                    animate={{ backgroundColor: highlighted ? 'color-mix(in oklab, var(--color-warn) 10%, transparent)' : 'transparent' }}
                                    transition={{ duration: 1.2 }}
                                    className="border-t border-line/60"
                                >
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className={cn('px-3 py-2 whitespace-nowrap', highlighted && 'text-warn')}>
                                            {cell}
                                            {highlighted && cellIndex === row.length - 1 && (
                                                <span className="ml-2 rounded bg-warn/20 px-1.5 py-px font-sans text-[10px] font-semibold uppercase">
                                                    {table.highlightKind === 'used' ? 'utilisée' : 'nouvelle'}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
