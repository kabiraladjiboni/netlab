import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BarChart3, CheckCircle2, CircleAlert, CloudCheck, CloudOff, GraduationCap, Info, Keyboard, PartyPopper, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ScenarioPlayer } from '@/components/engine/scenario-player';
import { EngagementBar } from '@/components/learning/engagement';
import type { Engagement } from '@/components/learning/engagement';
import { VariantPicker } from '@/components/learning/variant-picker';
import { LevelSwitch } from '@/components/layout/level-switch';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { useLabSession } from '@/hooks/use-lab-session';
import type { LabSessionData } from '@/hooks/use-lab-session';
import type { Scenario } from '@/engine/types';
import { cn } from '@/lib/utils';
import { resolveVariants } from '@/scenarios';
import type { LessonSummary, Quiz } from '@/types/content';

type Props = {
    lesson: LessonSummary & { scenario_key: string; concepts: string[] };
    quiz: Quiz | null;
    customScenario: Scenario | null;
    resume: LabSessionData | null;
    completedCount: number;
    initialVariant: string | null;
    engagement: Engagement;
};

/**
 * Laboratoire : l'espace de travail du TP. La scène, les explications, les
 * détails techniques (repliés) et les commandes sont clairement séparés.
 */
export default function LabShow({ lesson, quiz, customScenario, resume, completedCount, initialVariant, engagement }: Props) {
    const variants = useMemo(() => resolveVariants(lesson.scenario_key, customScenario), [lesson.scenario_key, customScenario]);
    const [variantId, setVariantId] = useState(() => variants.find((v) => v.id === initialVariant)?.id ?? variants[0]?.id ?? '');
    const variant = variants.find((v) => v.id === variantId) ?? variants[0];
    const variantKey = variant && variants.length > 1 ? variant.id : null;
    const total = variant?.scenario.steps.length ?? 0;

    const lab = useLabSession(lesson.slug, variantKey, total, Boolean(variant));
    const session = lab.session;
    const seen = session?.steps_seen.length ?? 0;
    const startStep = resume && resume.variant === variantKey && resume.status === 'in_progress' ? resume.current_step : 0;

    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            if (variantKey && variantKey !== variants[0]?.id) url.searchParams.set('variante', variantKey);
            else url.searchParams.delete('variante');
            window.history.replaceState(window.history.state, '', url);
        } catch {
            /* sans importance */
        }
    }, [variantKey, variants]);

    if (!variant) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                <CircleAlert className="mx-auto size-10 text-warn" aria-hidden />
                <p className="mt-3">Ce TP n’est pas disponible pour le moment.</p>
            </div>
        );
    }

    return (
        <>
            <Head title={`TP — ${lesson.title}`} />
            <div className="border-b border-line/60 bg-night-850/60">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
                    <div className="flex w-full min-w-0 items-center gap-3 lg:w-auto lg:flex-1">
                        <Link href={lesson.href} className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="size-4" aria-hidden /> Leçon
                        </Link>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold tracking-[0.16em] text-signal uppercase">Laboratoire · TP</p>
                            <h1 className="font-display text-xl leading-tight font-semibold sm:truncate sm:text-2xl">{lesson.title}</h1>
                        </div>
                    </div>
                    <SaveIndicator saving={!session && !lab.error} error={lab.error} />
                    <div className="flex min-w-[11rem] flex-col gap-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Étapes vues</span>
                            <span className="font-mono">
                                {seen}/{total}
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-night-700" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={seen} aria-label="Progression du TP">
                            <div className={cn('h-full rounded-full transition-all', session?.status === 'completed' ? 'bg-ok' : 'bg-signal')} style={{ width: `${total ? (seen / total) * 100 : 0}%` }} />
                        </div>
                    </div>
                    <LevelSwitch />
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
                {variants.length > 1 && <VariantPicker variants={variants} value={variant.id} onChange={setVariantId} className="mb-5" />}
                {lab.justCompleted && (
                    <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-ok/40 bg-ok/10 p-5 sm:flex-row sm:items-center" role="status">
                        <PartyPopper className="size-9 shrink-0 text-ok" aria-hidden />
                        <div className="flex-1">
                            <p className="font-display text-lg font-semibold">TP terminé, bravo Abòrò !</p>
                            <p className="text-sm text-muted-foreground">Toutes les étapes ont été vues. Valide maintenant ce que tu as compris avec le quiz, ou explore une autre situation.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {quiz && (
                                <a href="#quiz" className="rounded-xl bg-ok px-4 py-2 text-sm font-semibold text-on-accent">
                                    Passer le quiz
                                </a>
                            )}
                            <Link href={`/laboratoire/${lesson.slug}/resultats`} className="rounded-xl border border-line px-4 py-2 text-sm font-medium">
                                Mes résultats
                            </Link>
                        </div>
                    </div>
                )}
                <ScenarioPlayer
                    key={`${variant.scenario.id}-${session ? 'ready' : 'wait'}`}
                    scenario={variant.scenario}
                    contextTitle={lesson.title}
                    initialStep={session && session.status !== 'completed' ? Math.min(session.current_step || startStep, total - 1) : 0}
                    onStepChange={lab.recordStep}
                />
            </div>

            <div className="mx-auto mt-8 grid grid-cols-1 max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <details className="group rounded-3xl border border-line bg-surface p-5 sm:p-6">
                    <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-lg font-semibold">
                        <Info className="size-5 text-signal" aria-hidden /> Hypothèses et simplifications
                        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Afficher</span>
                    </summary>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                        {variant.scenario.assumptions.map((assumption) => (
                            <li key={assumption}>{assumption}</li>
                        ))}
                    </ul>
                </details>
                <div className="space-y-4 rounded-3xl border border-line bg-surface p-5 text-sm sm:p-6">
                    <p className="flex items-center gap-2 font-display text-lg font-semibold">
                        <Keyboard className="size-5 text-signal" aria-hidden /> Raccourcis
                    </p>
                    <p className="text-muted-foreground">
                        <kbd className="kbd">Espace</kbd> lecture/pause · <kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd> étapes · <kbd className="kbd">R</kbd> rejouer
                    </p>
                    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                        <Link href={`/laboratoire/${lesson.slug}/resultats`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 font-medium hover:bg-night-800">
                            <BarChart3 className="size-4" aria-hidden /> Mes résultats
                        </Link>
                        {completedCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-ok/10 px-3 py-2 text-ok">
                                <CheckCircle2 className="size-4" aria-hidden /> Terminé {completedCount} fois
                            </span>
                        )}
                        {session?.status === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <RotateCcw className="size-3.5" aria-hidden /> TP terminé : tu peux le rejouer librement, ta réussite reste enregistrée.
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
                <EngagementBar engagement={engagement} type="lab" slug={lesson.slug} className="rounded-2xl border border-line bg-surface px-4 py-3" />
            </div>

            {quiz && (
                <section id="quiz" className="mx-auto mt-10 max-w-3xl scroll-mt-24 px-4 sm:px-6" aria-labelledby="quiz-title">
                    <h2 id="quiz-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
                        <GraduationCap className="size-6 text-signal" aria-hidden /> Valider le TP
                    </h2>
                    <p className="mt-1 mb-5 text-muted-foreground">Ton score est enregistré dans tes résultats. Tu peux recommencer autant de fois que tu veux.</p>
                    <QuizRunner quiz={quiz} />
                </section>
            )}
        </>
    );
}

function SaveIndicator({ saving, error }: { saving: boolean; error: string | null }) {
    if (error) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-danger" title={error}>
                <CloudOff className="size-4" aria-hidden /> Progression non enregistrée
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CloudCheck className={cn('size-4', saving ? 'animate-pulse' : 'text-ok')} aria-hidden /> {saving ? 'Connexion…' : 'Progression sauvegardée'}
        </span>
    );
}
