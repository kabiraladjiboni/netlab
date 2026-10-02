import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Gauge, Pause, Play, RotateCcw, Repeat, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SPEEDS } from '@/engine/use-scenario-player';
import type { PlayerAction, PlayerState, Speed } from '@/engine/use-scenario-player';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

const speedLabel: Record<Speed, string> = { 0.5: 'Ralenti ×0,5', 1: 'Normal ×1', 1.5: 'Rapide ×1,5' };

function ControlButton({
    label,
    shortcut,
    onClick,
    disabled,
    primary,
    children,
}: {
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    primary?: boolean;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    aria-label={shortcut ? `${label} (${shortcut})` : label}
                    className={cn(
                        'inline-flex shrink-0 items-center justify-center rounded-full transition-all disabled:pointer-events-none disabled:opacity-35',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal active:scale-95',
                        primary
                            ? 'size-12 bg-gradient-to-br from-signal to-[color-mix(in_oklab,var(--color-signal)_70%,var(--color-gold))] text-on-accent shadow-lg shadow-signal/25 hover:brightness-110 sm:size-13'
                            : 'size-10 text-foreground/85 hover:bg-night-700 hover:text-foreground',
                    )}
                >
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">
                {label}
                {shortcut && <span className="ml-2 opacity-70">{shortcut}</span>}
            </TooltipContent>
        </Tooltip>
    );
}

export function PlayerControls({
    state,
    dispatch,
    isFirst,
    stepLabel,
}: {
    state: PlayerState;
    dispatch: (action: PlayerAction) => void;
    isFirst: boolean;
    stepLabel: string;
}) {
    const { reduceMotionSetting, setReduceMotion } = usePreferences();
    const playing = state.status === 'playing';
    const nextSpeed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length];

    return (
        <div className="glass flex items-center justify-between gap-1 rounded-full px-2 py-1.5 sm:gap-2 sm:px-3" role="toolbar" aria-label="Contrôles de l'animation">
            <div className="flex items-center gap-0.5 sm:gap-1">
                <ControlButton label="Recommencer depuis le début" onClick={() => dispatch({ type: 'restart' })}>
                    <RotateCcw className="size-[18px]" aria-hidden />
                </ControlButton>
                <ControlButton label="Étape précédente" shortcut="←" onClick={() => dispatch({ type: 'prev' })} disabled={isFirst}>
                    <ChevronLeft className="size-5" aria-hidden />
                </ControlButton>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3">
                <ControlButton
                    primary
                    label={playing ? 'Mettre en pause' : state.status === 'ended' ? 'Rejouer le scénario' : 'Lecture'}
                    shortcut="Espace"
                    onClick={() => dispatch({ type: 'toggle' })}
                >
                    {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden />}
                </ControlButton>
                <span className="sr-only" aria-live="polite">
                    {playing ? 'Lecture en cours' : 'En pause'} — {stepLabel}
                </span>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1">
                <ControlButton label="Étape suivante" shortcut="→" onClick={() => dispatch({ type: 'next' })} disabled={state.status === 'ended'}>
                    <ChevronRight className="size-5" aria-hidden />
                </ControlButton>
                <ControlButton label="Rejouer cette étape" shortcut="R" onClick={() => dispatch({ type: 'replay' })}>
                    <Repeat className="size-[18px]" aria-hidden />
                </ControlButton>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => dispatch({ type: 'speed', speed: nextSpeed })}
                            className="inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 font-mono text-xs text-foreground/85 hover:bg-night-700 focus-visible:outline-2 focus-visible:outline-signal"
                            aria-label={`Vitesse : ${speedLabel[state.speed]}. Passer à ${speedLabel[nextSpeed]}`}
                        >
                            <Gauge className="size-4" aria-hidden />×{String(state.speed).replace('.', ',')}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Vitesse de l'animation</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => setReduceMotion(!reduceMotionSetting)}
                            aria-pressed={reduceMotionSetting}
                            className={cn(
                                'hidden size-10 items-center justify-center rounded-full hover:bg-night-700 focus-visible:outline-2 focus-visible:outline-signal sm:inline-flex',
                                reduceMotionSetting ? 'text-warn' : 'text-foreground/85',
                            )}
                            aria-label={reduceMotionSetting ? 'Réactiver les effets animés' : 'Réduire les effets animés'}
                        >
                            <Sparkles className="size-[18px]" aria-hidden />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{reduceMotionSetting ? 'Effets réduits (cliquer pour réactiver)' : 'Réduire les effets'}</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
