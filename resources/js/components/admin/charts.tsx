import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Graphiques SVG légers de l'administration.
 * Règles : un seul axe, traits fins (2px), extrémités arrondies de 4px,
 * grille discrète, légende dès deux séries, info-bulle au survol,
 * tableau de données accessible (lecteurs d'écran) pour chaque graphique.
 * Les couleurs sont des tokens du thème : elles changent avec clair/sombre.
 */

export type Series = { key: string; label: string; color: string; values: number[] };

export const SERIES_COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)'];

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export const shortDay = (day: string) => dayFormat.format(new Date(`${day}T12:00:00`));

function niceMax(value: number): number {
    if (value <= 4) return 4;
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find((s) => s * power * 4 >= value) ?? 10;
    return step * power * 4;
}

function Legend({ series }: { series: Series[] }) {
    if (series.length < 2) return null;
    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {series.map((s) => (
                <li key={s.key} className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.label}
                </li>
            ))}
        </ul>
    );
}

function DataTable({ caption, labels, series }: { caption: string; labels: string[]; series: Series[] }) {
    return (
        <table className="sr-only">
            <caption>{caption}</caption>
            <thead>
                <tr>
                    <th scope="col">Période</th>
                    {series.map((s) => (
                        <th key={s.key} scope="col">
                            {s.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {labels.map((label, index) => (
                    <tr key={label}>
                        <th scope="row">{label}</th>
                        {series.map((s) => (
                            <td key={s.key}>{s.values[index]}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Largeur réelle du conteneur : le texte des axes garde ainsi une taille constante. */
function useWidth(fallback = 640) {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(fallback);
    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

/** Courbe(s) dans le temps avec réticule et info-bulle. */
export function LineChart({ labels, series, caption, height = 200, formatLabel = shortDay }: { labels: string[]; series: Series[]; caption: string; height?: number; formatLabel?: (label: string) => string }) {
    const [hover, setHover] = useState<number | null>(null);
    const [ref, W] = useWidth();
    const gradientId = useId();
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
    const innerW = W - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
    const every = Math.max(1, Math.ceil(labels.length / Math.max(3, Math.floor(W / 90))));
    const empty = series.every((s) => s.values.every((v) => v === 0));

    return (
        <figure className="space-y-2">
            <Legend series={series} />
            <div className="relative" ref={ref}>
                <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={series[0]?.color} stopOpacity={0.14} />
                            <stop offset="100%" stopColor={series[0]?.color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" strokeWidth={1} />
                            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted-foreground)">
                                {formatNumber(Math.round(tick))}
                            </text>
                        </g>
                    ))}
                    {labels.map((label, i) =>
                        i % every === 0 || i === labels.length - 1 ? (
                            <text key={label} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--color-muted-foreground)">
                                {formatLabel(label)}
                            </text>
                        ) : null,
                    )}
                    {series[0] && series.length === 1 && labels.length > 1 && (
                        <path d={`M${x(0)},${y(0)} ${series[0].values.map((v, i) => `L${x(i)},${y(v)}`).join(' ')} L${x(labels.length - 1)},${y(0)} Z`} fill={`url(#${gradientId})`} />
                    )}
                    {series.map((s) => (
                        <polyline key={s.key} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    ))}
                    {hover !== null && (
                        <g>
                            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-muted-foreground)" strokeWidth={1} opacity={0.5} />
                            {series.map((s) => (
                                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="var(--color-card)" strokeWidth={2} />
                            ))}
                        </g>
                    )}
                    {labels.map((label, i) => {
                        const left = i === 0 ? PAD.left : (x(i - 1) + x(i)) / 2;
                        const right = i === labels.length - 1 ? W - PAD.right : (x(i) + x(i + 1)) / 2;
                        return <rect key={label} x={left} y={PAD.top} width={Math.max(1, right - left)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />;
                    })}
                </svg>
                {hover !== null && (
                    <Tooltip left={`${(x(hover) / W) * 100}%`} title={formatLabel(labels[hover])}>
                        {series.map((s) => (
                            <span key={s.key} className="flex items-center justify-between gap-3">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                                    {s.label}
                                </span>
                                <strong className="font-semibold">{formatNumber(s.values[hover])}</strong>
                            </span>
                        ))}
                    </Tooltip>
                )}
                {empty && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Aucune donnée sur cette période</p>}
            </div>
            <DataTable caption={caption} labels={labels.map(formatLabel)} series={series} />
        </figure>
    );
}

function Tooltip({ left, title, children }: { left: string; title: string; children: ReactNode }) {
    return (
        <div className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-line bg-popover px-3 py-2 text-xs shadow-xl shadow-[var(--shadow-color)]" style={{ left }}>
            <p className="mb-1 font-medium text-muted-foreground">{title}</p>
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

/** Colonnes (une série), ex. activité par heure. */
export function ColumnChart({ labels, values, caption, color = 'var(--color-chart-1)', height = 180, formatLabel = (l: string) => l }: { labels: string[]; values: number[]; caption: string; color?: string; height?: number; formatLabel?: (label: string) => string }) {
    const [hover, setHover] = useState<number | null>(null);
    const [ref, W] = useWidth();
    const max = niceMax(Math.max(1, ...values));
    const innerW = W - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const band = innerW / Math.max(1, values.length);
    const bar = Math.min(24, band - 2);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    const every = Math.max(1, Math.ceil(labels.length / Math.max(4, Math.floor(W / 60))));
    return (
        <figure>
            <div className="relative" ref={ref}>
                <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
                    {[0, max / 2, max].map((tick) => (
                        <g key={tick}>
                            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" strokeWidth={1} />
                            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted-foreground)">
                                {formatNumber(Math.round(tick))}
                            </text>
                        </g>
                    ))}
                    {values.map((value, i) => {
                        const cx = PAD.left + band * i + band / 2;
                        const h = Math.max(0, PAD.top + innerH - y(value));
                        const r = Math.min(4, h, bar / 2);
                        const top = PAD.top + innerH - h;
                        return (
                            <g key={labels[i]} onMouseEnter={() => setHover(i)}>
                                <rect x={cx - band / 2} y={PAD.top} width={band} height={innerH} fill="transparent" />
                                {h > 0 && (
                                    <path
                                        d={`M${cx - bar / 2},${top + h} V${top + r} Q${cx - bar / 2},${top} ${cx - bar / 2 + r},${top} H${cx + bar / 2 - r} Q${cx + bar / 2},${top} ${cx + bar / 2},${top + r} V${top + h} Z`}
                                        fill={color}
                                        opacity={hover === null || hover === i ? 1 : 0.45}
                                    />
                                )}
                                {(i % every === 0 || i === values.length - 1) && (
                                    <text x={cx} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--color-muted-foreground)">
                                        {formatLabel(labels[i])}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
                {hover !== null && (
                    <Tooltip left={`${((PAD.left + band * hover + band / 2) / W) * 100}%`} title={formatLabel(labels[hover])}>
                        <strong className="font-semibold">{formatNumber(values[hover])}</strong>
                    </Tooltip>
                )}
            </div>
            <DataTable caption={caption} labels={labels.map(formatLabel)} series={[{ key: 'v', label: 'Valeur', color, values }]} />
        </figure>
    );
}

/** Classement horizontal : libellé, barre proportionnelle, valeur. */
export function RankedBars({ items, color = 'var(--color-chart-1)', empty = 'Aucune donnée sur cette période.', format = formatNumber }: { items: { key: string; label: ReactNode; value: number; href?: string | null; extra?: ReactNode }[]; color?: string; empty?: string; format?: (value: number) => string }) {
    const max = Math.max(1, ...items.map((item) => item.value));
    if (items.length === 0) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
    return (
        <ol className="space-y-2.5">
            {items.map((item) => (
                <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                    <span className="truncate">{item.label}</span>
                    <span className="text-right font-medium tabular-nums">
                        {format(item.value)}
                        {item.extra}
                    </span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-night-700">
                        <span className="block h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
                    </span>
                </li>
            ))}
        </ol>
    );
}

/** Barre empilée à deux segments (ex. « utile » / « pas encore clair »), avec écart de 2px. */
export function SplitBar({ a, b, labelA, labelB, colorA, colorB, className }: { a: number; b: number; labelA: string; labelB: string; colorA: string; colorB: string; className?: string }) {
    const total = a + b;
    if (total === 0) return <span className={cn('block h-2 rounded-full bg-night-700', className)} />;
    return (
        <span className={cn('flex h-2 gap-0.5', className)} title={`${labelA} : ${a} · ${labelB} : ${b}`} role="img" aria-label={`${labelA} ${a}, ${labelB} ${b}`}>
            {a > 0 && <span className="h-full rounded-full" style={{ width: `${(a / total) * 100}%`, background: colorA }} />}
            {b > 0 && <span className="h-full rounded-full" style={{ width: `${(b / total) * 100}%`, background: colorB }} />}
        </span>
    );
}

/** Indicateur chiffré avec définition. */
export function Kpi({ label, value, hint, tone = 'default', icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'live'; icon?: React.ComponentType<{ className?: string }> }) {
    return (
        <div className="rounded-2xl border border-line bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {tone === 'live' && <span className="size-2 animate-pulse rounded-full bg-ok" aria-hidden />}
                {Icon && <Icon className="size-3.5" />}
                {label}
            </p>
            <p className="mt-1.5 font-display text-[1.7rem] leading-none font-semibold tabular-nums">{value}</p>
            {hint && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function useSeries(series: Record<string, { day: string; value: number }[]>, picks: { key: string; label: string; color?: string }[]) {
    return useMemo(() => {
        const first = series[picks[0].key] ?? [];
        return {
            labels: first.map((point) => point.day),
            series: picks.map((pick, index) => ({ key: pick.key, label: pick.label, color: pick.color ?? SERIES_COLORS[index], values: (series[pick.key] ?? []).map((point) => point.value) })),
        };
    }, [series, picks]);
}
