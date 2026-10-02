import { FlaskConical } from 'lucide-react';
import type { ScenarioVariant } from '@/engine/types';
import { cn } from '@/lib/utils';

/** Choix de la variante : chaque variante raconte une situation différente (réussite, panne…). */
export function VariantPicker({ variants, value, onChange, className }: { variants: ScenarioVariant[]; value: string; onChange: (id: string) => void; className?: string }) {
    if (variants.length < 2) return null;
    const current = variants.find((variant) => variant.id === value) ?? variants[0];
    return (
        <div className={className}>
            <p id="variantes" className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <FlaskConical className="size-3.5" aria-hidden /> Situation à explorer
            </p>
            <select
                value={current.id}
                onChange={(event) => onChange(event.target.value)}
                aria-labelledby="variantes"
                className="w-full rounded-xl border border-input bg-night-850 px-3 py-2.5 text-sm sm:hidden"
            >
                {variants.map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.status === 'error' ? '⚠ ' : ''}
                        {item.label}
                    </option>
                ))}
            </select>
            <div role="radiogroup" aria-labelledby="variantes" className="hidden flex-wrap gap-2 sm:flex">
                {variants.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={item.id === current.id}
                        onClick={() => onChange(item.id)}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
                            item.id === current.id ? 'border-signal bg-signal/15 font-medium text-foreground' : 'border-line text-muted-foreground hover:border-signal/50 hover:text-foreground',
                        )}
                    >
                        <span className={cn('size-2 rounded-full', item.status === 'error' ? 'bg-danger' : item.status === 'warning' ? 'bg-warn' : 'bg-ok')} aria-hidden />
                        {item.label}
                    </button>
                ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{current.description}</p>
        </div>
    );
}
