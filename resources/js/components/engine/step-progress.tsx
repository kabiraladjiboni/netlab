import { motion } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useTransform } from 'motion/react';
import type { ScenarioStep } from '@/engine/types';
import { cn } from '@/lib/utils';

const statusDot: Record<NonNullable<ScenarioStep['status']>, string> = {
    info: 'bg-signal',
    ok: 'bg-ok',
    warning: 'bg-warn',
    error: 'bg-danger',
};

export function StepProgress({
    steps,
    index,
    onSelect,
    time,
    duration,
}: {
    steps: ScenarioStep[];
    index: number;
    onSelect: (index: number) => void;
    time: MotionValue<number>;
    duration: number;
}) {
    const fill = useTransform(time, (t) => `${Math.min(100, (t / Math.max(duration, 0.001)) * 100)}%`);

    return (
        <nav aria-label="Étapes du scénario" className="w-full">
            <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                <span className="font-mono text-muted-foreground">
                    Étape <span className="text-foreground">{index + 1}</span> / {steps.length}
                </span>
                <span className="truncate text-right font-medium text-foreground/90">{steps[index]?.title}</span>
            </div>
            <ol className="flex gap-1">
                {steps.map((step, i) => {
                    const done = i < index;
                    const current = i === index;
                    return (
                        <li key={step.id} className="min-w-0 flex-1">
                            <button
                                type="button"
                                onClick={() => onSelect(i)}
                                aria-current={current ? 'step' : undefined}
                                aria-label={`Aller à l'étape ${i + 1} : ${step.title}`}
                                title={`${i + 1}. ${step.title}`}
                                className="group relative block h-6 w-full focus-visible:outline-2 focus-visible:outline-signal"
                            >
                                <span
                                    className={cn(
                                        'absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full transition-colors',
                                        done ? 'bg-signal/70' : 'bg-night-700 group-hover:bg-night-600',
                                    )}
                                >
                                    {current && <motion.span className="absolute inset-y-0 left-0 rounded-full bg-signal" style={{ width: fill }} />}
                                </span>
                                {step.status && step.status !== 'info' && (
                                    <span className={cn('absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full', statusDot[step.status])} aria-hidden />
                                )}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
