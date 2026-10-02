import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, CircleAlert, Clock, ExternalLink, GraduationCap, Info, ListOrdered, MonitorPlay, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { plainText, RichText } from '@/components/content/rich-text';
import { TermLink } from '@/components/content/term-link';
import { ScenarioPlayer } from '@/components/engine/scenario-player';
import { EngagementBar } from '@/components/learning/engagement';
import type { Engagement } from '@/components/learning/engagement';
import { LabGate } from '@/components/learning/lab-gate';
import type { AccessStatus } from '@/components/learning/lab-gate';
import { VariantPicker } from '@/components/learning/variant-picker';
import { LevelSwitch } from '@/components/layout/level-switch';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { LabSessionData } from '@/hooks/use-lab-session';
import { usePreferences } from '@/hooks/use-preferences';
import { textFor } from '@/engine/types';
import type { Scenario } from '@/engine/types';
import { resolveVariants } from '@/scenarios';
import type { LessonSummary, ProtocolSummary, Quiz } from '@/types/content';

type Props = {
    lesson: LessonSummary & { scenario_key: string; concepts: string[]; intro: string | null; references: { label: string; url: string | null }[]; course: { slug: string; title: string } | null; draft: boolean };
    quiz: Quiz | null;
    protocols: ProtocolSummary[];
    previous: LessonSummary | null;
    next: LessonSummary | null;
    access: AccessStatus;
    labAvailable: boolean;
    previewSteps: number;
    customScenario: Scenario | null;
    session: (LabSessionData & { status: string }) | null;
    engagement: Engagement;
};

export default function LessonShow({ lesson, quiz, protocols, previous, next, access, labAvailable, previewSteps, customScenario, session, engagement }: Props) {
    const { level } = usePreferences();
    const variants = useMemo(() => resolveVariants(lesson.scenario_key, customScenario), [lesson.scenario_key, customScenario]);
    const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
    const variant = variants.find((item) => item.id === variantId) ?? variants[0];
    const labHref = `/laboratoire/${lesson.slug}`;

    if (!variant) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                <CircleAlert className="mx-auto size-10 text-warn" aria-hidden />
                <p className="mt-3">L’animation de cette leçon n’est pas disponible pour le moment.</p>
            </div>
        );
    }

    const steps = variants[0].scenario.steps;

    return (
        <>
            {lesson.draft && (
                <div className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-sm text-warn">
                    <TriangleAlert className="mr-1.5 inline size-4" aria-hidden /> Brouillon — aperçu visible uniquement par les administrateurs.
                </div>
            )}

            {/* 1. En-tête : de quoi parle la leçon et quelle est l'action principale */}
            <header className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
                <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <Link href="/apprendre" className="hover:text-foreground">
                        Cours
                    </Link>
                    {lesson.course && (
                        <>
                            <ChevronRight className="size-3.5" aria-hidden />
                            <Link href={`/cours/${lesson.course.slug}`} className="hover:text-foreground">
                                {lesson.course.title}
                            </Link>
                        </>
                    )}
                </nav>
                <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                    <div>
                        <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{lesson.title}</h1>
                        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{lesson.objective}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                                <Clock className="size-4" aria-hidden /> {lesson.duration} min
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <ListOrdered className="size-4" aria-hidden /> {steps.length} étapes
                            </span>
                            {variants.length > 1 && (
                                <span className="inline-flex items-center gap-1.5">
                                    <MonitorPlay className="size-4" aria-hidden /> {variants.length} situations à explorer
                                </span>
                            )}
                        </div>
                        {lesson.concepts.length > 0 && (
                            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Notions :</span>
                                {lesson.concepts.map((concept) => (
                                    <span key={concept} className="rounded-full border border-line px-2.5 py-0.5 text-[13px]">
                                        <TermLink slug={concept} label={concept} />
                                    </span>
                                ))}
                            </p>
                        )}
                    </div>
                    {labAvailable && <LabGate access={access} labHref={labHref} resume={session ? { progress: session.progress, step: session.current_step, total: session.total_steps } : null} className="lg:mt-2" />}
                </div>
            </header>

            {/* 2. Aperçu animé (limité) */}
            <section className="mx-auto mt-8 max-w-7xl px-4 sm:px-6" aria-labelledby="apercu">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 id="apercu" className="font-display text-xl font-semibold">
                            Aperçu de l’animation
                        </h2>
                        <p className="text-sm text-muted-foreground">Les {Math.min(previewSteps, steps.length)} premières étapes, librement. La suite se joue dans le laboratoire.</p>
                    </div>
                    <LevelSwitch />
                </div>
                <ScenarioPlayer
                    key={variant.scenario.id}
                    scenario={variant.scenario}
                    contextTitle={lesson.title}
                    stepLimit={previewSteps}
                    lockedSlot={labAvailable ? <LabGate access={access} labHref={labHref} compact /> : undefined}
                />
            </section>

            {/* 3. Plan de la leçon et contexte */}
            <div className="mx-auto mt-10 grid grid-cols-1 max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="plan">
                    <h2 id="plan" className="flex items-center gap-2 font-display text-lg font-semibold">
                        <ListOrdered className="size-5 text-signal" aria-hidden /> Ce que tu vas voir, étape par étape
                    </h2>
                    <ol className="mt-4 space-y-2">
                        {steps.map((step, index) => (
                            <li key={step.id} className="flex gap-3 text-sm">
                                <span className={index < previewSteps ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-signal/15 font-mono text-xs font-semibold text-signal' : 'flex size-6 shrink-0 items-center justify-center rounded-full bg-night-700 font-mono text-xs text-muted-foreground'}>
                                    {index + 1}
                                </span>
                                <span className="pt-0.5">
                                    <span className="font-medium">{step.title}</span>
                                    {level >= 2 && index < previewSteps && <span className="block text-xs text-muted-foreground">{plainText(textFor(step.text, 1)).slice(0, 110)}…</span>}
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>
                <div className="space-y-5">
                    {lesson.intro && (
                        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
                            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                                <BookOpen className="size-5 text-signal" aria-hidden /> Avant de commencer
                            </h2>
                            <div className="mt-3">
                                <RichText text={lesson.intro} />
                            </div>
                        </section>
                    )}
                    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="hypotheses">
                        <h2 id="hypotheses" className="flex items-center gap-2 font-display text-lg font-semibold">
                            <Info className="size-5 text-signal" aria-hidden /> Hypothèses et simplifications
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">Un scénario pédagogique déterministe, pas l’observation d’un vrai réseau.</p>
                        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                            {variant.scenario.assumptions.map((assumption) => (
                                <li key={assumption}>{assumption}</li>
                            ))}
                        </ul>
                    </section>
                    {(protocols.length > 0 || lesson.references.length > 0) && (
                        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
                            {protocols.length > 0 && (
                                <>
                                    <h2 className="font-display text-lg font-semibold">Fiches liées</h2>
                                    <ul className="mt-3 flex flex-wrap gap-2">
                                        {protocols.map((protocol) => (
                                            <li key={protocol.slug}>
                                                <Link href={`/protocoles/${protocol.slug}`} className="inline-flex rounded-full border border-line px-3 py-1 font-mono text-sm hover:border-signal/60 hover:text-signal">
                                                    {protocol.acronym}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {lesson.references.length > 0 && (
                                <>
                                    <h2 className="mt-5 font-display text-lg font-semibold">Références</h2>
                                    <ul className="mt-2 space-y-1.5 text-sm">
                                        {lesson.references.map((reference) => (
                                            <li key={reference.label}>
                                                {reference.url ? (
                                                    <a href={reference.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-signal hover:underline">
                                                        {reference.label} <ExternalLink className="size-3" aria-hidden />
                                                    </a>
                                                ) : (
                                                    reference.label
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>
                    )}
                </div>
            </div>

            {variants.length > 1 && (
                <section className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
                    <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
                        <VariantPicker variants={variants} value={variant.id} onChange={setVariantId} />
                        <p className="mt-3 text-xs text-muted-foreground">Choisis une situation pour en voir l’aperçu ci-dessus. Toutes les situations se jouent en entier dans le laboratoire.</p>
                    </div>
                </section>
            )}

            <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
                <EngagementBar engagement={engagement} type="lesson" slug={lesson.slug} className="rounded-2xl border border-line bg-surface px-4 py-3" />
            </div>

            {quiz && (
                <section className="mx-auto mt-10 max-w-3xl px-4 sm:px-6" aria-labelledby="quiz">
                    <h2 id="quiz" className="flex items-center gap-2 font-display text-2xl font-semibold">
                        <GraduationCap className="size-6 text-signal" aria-hidden /> Vérifier ta compréhension
                    </h2>
                    <p className="mt-1 mb-5 text-muted-foreground">Quelques questions, chaque correction est expliquée.</p>
                    <QuizRunner quiz={quiz} />
                </section>
            )}

            <nav aria-label="Leçons voisines" className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:justify-between sm:px-6">
                {previous ? (
                    <Link href={previous.href} className="group inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-3 hover:border-signal/50">
                        <ArrowLeft className="size-4 transition group-hover:-translate-x-1" aria-hidden />
                        <span>
                            <span className="block text-xs text-muted-foreground">Chapitre précédent</span>
                            <span className="font-medium">{previous.title}</span>
                        </span>
                    </Link>
                ) : (
                    <span />
                )}
                {next && (
                    <Link href={next.href} className="group inline-flex items-center justify-end gap-2 rounded-2xl border border-line px-4 py-3 text-right hover:border-signal/50">
                        <span>
                            <span className="block text-xs text-muted-foreground">Chapitre suivant</span>
                            <span className="font-medium">{next.title}</span>
                        </span>
                        <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                    </Link>
                )}
            </nav>
        </>
    );
}
