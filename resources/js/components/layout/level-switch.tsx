import { LEVELS, usePreferences } from '@/hooks/use-preferences';
import type { Level } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

/** Sélecteur de niveau (1 Je découvre / 2 Je comprends / 3 J'approfondis). */
export function LevelSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
    const { level, setLevel } = usePreferences();
    return (
        <div role="radiogroup" aria-label="Niveau d'explication" className={cn('inline-flex rounded-xl border border-line bg-night-850/80 p-0.5', className)}>
            {LEVELS.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={level === item.value}
                    onClick={() => setLevel(item.value as Level)}
                    title={`${item.label} — ${item.description}`}
                    className={cn(
                        'flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium transition-colors',
                        level === item.value ? 'bg-night-600 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <span className={cn('flex size-4 items-center justify-center rounded-full font-mono text-[10px]', level === item.value ? 'bg-signal text-on-accent' : 'bg-night-700')}>
                        {item.value}
                    </span>
                    <span className={compact ? 'hidden lg:inline xl:hidden 2xl:inline' : undefined}>{item.short}</span>
                </button>
            ))}
        </div>
    );
}
