import { Monitor, Moon, Sun } from 'lucide-react';
import { type ThemeSetting, usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

const NEXT: Record<ThemeSetting, ThemeSetting> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeSetting, string> = { system: 'Thème : automatique', light: 'Thème : clair', dark: 'Thème : sombre' };

/** Bouton compact : automatique → clair → sombre. */
export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = usePreferences();
    const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
    return (
        <button
            type="button"
            onClick={() => setTheme(NEXT[theme])}
            className={cn('flex size-9 items-center justify-center rounded-xl border border-line text-muted-foreground transition-colors hover:text-foreground', className)}
            aria-label={`${LABEL[theme]} (cliquer pour changer)`}
            title={LABEL[theme]}
        >
            <Icon className="size-4" aria-hidden />
        </button>
    );
}

/** Sélecteur explicite (menu mobile, paramètres). */
export function ThemeSelect() {
    const { theme, setTheme } = usePreferences();
    const options: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
        { value: 'light', label: 'Clair', icon: Sun },
        { value: 'dark', label: 'Sombre', icon: Moon },
        { value: 'system', label: 'Auto', icon: Monitor },
    ];
    return (
        <div role="radiogroup" aria-label="Thème" className="inline-flex rounded-xl border border-line bg-night-850/80 p-0.5">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={theme === option.value}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                        'flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors',
                        theme === option.value ? 'bg-night-600 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <option.icon className="size-3.5" aria-hidden />
                    {option.label}
                </button>
            ))}
        </div>
    );
}
