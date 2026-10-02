import { router, usePage } from '@inertiajs/react';
import { CalendarRange, Download } from 'lucide-react';
import { useState } from 'react';
import { inputClass } from '@/components/forms/fields';
import { cn } from '@/lib/utils';

export type PeriodInfo = { key: string; label: string; from: string; to: string; presets: Record<string, string> };

/** Filtre de période unique, placé au-dessus des graphiques. */
export function PeriodFilter({ period, exports }: { period: PeriodInfo; exports?: { href: string; label: string }[] }) {
    const { url } = usePage();
    const path = url.split('?')[0];
    const [from, setFrom] = useState(period.from);
    const [to, setTo] = useState(period.to);
    const go = (params: Record<string, string>) => router.get(path, params, { preserveScroll: true, preserveState: false });
    const query = period.key === 'perso' ? `periode=perso&du=${period.from}&au=${period.to}` : `periode=${period.key}`;

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-2">
            <CalendarRange className="ml-1 size-4 text-muted-foreground" aria-hidden />
            <div role="radiogroup" aria-label="Période" className="flex flex-wrap gap-1">
                {Object.entries(period.presets)
                    .filter(([key]) => key !== 'perso')
                    .map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={period.key === key}
                            onClick={() => go({ periode: key })}
                            className={cn('rounded-lg px-3 py-1.5 text-sm', period.key === key ? 'bg-signal text-on-accent font-semibold' : 'text-muted-foreground hover:bg-night-800 hover:text-foreground')}
                        >
                            {label}
                        </button>
                    ))}
            </div>
            <form
                className="flex flex-wrap items-center gap-1.5"
                onSubmit={(event) => {
                    event.preventDefault();
                    go({ periode: 'perso', du: from, au: to });
                }}
            >
                <label className="sr-only" htmlFor="periode-du">
                    Du
                </label>
                <input id="periode-du" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={cn(inputClass, 'w-auto py-1.5')} />
                <span className="text-xs text-muted-foreground">au</span>
                <label className="sr-only" htmlFor="periode-au">
                    Au
                </label>
                <input id="periode-au" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={cn(inputClass, 'w-auto py-1.5')} />
                <button type="submit" className={cn('rounded-lg border px-3 py-1.5 text-sm', period.key === 'perso' ? 'border-signal text-signal' : 'border-line')}>
                    Appliquer
                </button>
            </form>
            {exports && (
                <div className="ml-auto flex gap-1">
                    {exports.map((item) => (
                        <a key={item.href} href={`${item.href}?${query}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-night-800 hover:text-foreground">
                            <Download className="size-3.5" aria-hidden /> {item.label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
