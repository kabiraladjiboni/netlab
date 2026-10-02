import { SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';
import { LevelSwitch } from './level-switch';
import { ThemeSelect } from './theme-toggle';

/** Regroupe niveau d'explication, thème et animations dans un seul menu. */
export function DisplayPreferences({ className }: { className?: string }) {
    return (
        <Popover>
            <PopoverTrigger
                className={cn('flex h-9 items-center gap-2 rounded-xl border border-line px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground', className)}
                aria-label="Affichage : niveau, thème, animations"
            >
                <SlidersHorizontal className="size-4" aria-hidden />
                <span className="hidden 2xl:inline">Affichage</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4 p-4">
                <PreferencesFields />
            </PopoverContent>
        </Popover>
    );
}

export function PreferencesFields() {
    const { reduceMotionSetting, setReduceMotion } = usePreferences();
    return (
        <>
            <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Niveau d’explication</p>
                <p className="mb-2 text-xs text-muted-foreground">Change la profondeur des textes dans toute la plateforme.</p>
                <LevelSwitch />
            </div>
            <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Thème</p>
                <ThemeSelect />
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
                Réduire les animations
                <input type="checkbox" className="size-5 accent-[var(--color-signal)]" checked={reduceMotionSetting} onChange={(event) => setReduceMotion(event.target.checked)} />
            </label>
        </>
    );
}
