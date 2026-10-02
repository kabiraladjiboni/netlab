import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, Eye, FileTerminal, Lightbulb, Lock, MessageCircleQuestion, NotebookPen, Radar, Stethoscope } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useAssistant, useAssistantContext } from '@/components/assistant/assistant-provider';
import { renderInline } from '@/components/content/rich-text';
import { useToast } from '@/components/layout/flash-toaster';
import { LabGate } from '@/components/learning/lab-gate';
import type { AccessStatus } from '@/components/learning/lab-gate';
import { usePreferences } from '@/hooks/use-preferences';
import { sendJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { difficultyStyle } from './index';

type Observation = { kind: 'command' | 'capture' | 'note'; title: string; lines: string[] };
type Diagnostic = {
    slug: string;
    title: string;
    difficulty: 'facile' | 'moyen' | 'difficile';
    summary: string;
    symptoms: string[];
    observations: Observation[];
    observations_total: number;
    hints_total: number;
    choices: string[];
};
type State = { status: string; attempts: number; hints: string[]; answer: number | null; explanation: string | null; related: { label: string; href: string }[] } | null;

const icons = { command: FileTerminal, capture: Radar, note: NotebookPen };

/**
 * Exercice de diagnostic. La bonne réponse n'est jamais envoyée au navigateur
 * avant d'être trouvée (ou après deux essais) : la correction vient du serveur.
 */
export default function DiagnosticShow({ diagnostic, access, state, next, previous }: { diagnostic: Diagnostic; access: AccessStatus; state: State; next: string | null; previous: string | null }) {
    const { reducedMotion } = usePreferences();
    const assistant = useAssistant();
    const { notify } = useToast();
    const [hints, setHints] = useState<string[]>(state?.hints ?? []);
    const [choice, setChoice] = useState<number | null>(null);
    const [wrong, setWrong] = useState<number[]>([]);
    const [attempts, setAttempts] = useState(state?.attempts ?? 0);
    const [answer, setAnswer] = useState<number | null>(state?.answer ?? null);
    const [explanation, setExplanation] = useState<string | null>(state?.explanation ?? null);
    const [related, setRelated] = useState(state?.related ?? []);
    const [solved, setSolved] = useState(state?.status === 'completed');
    const [busy, setBusy] = useState(false);
    const allowed = access === 'allowed';
    const revealed = explanation !== null;
    const lastWrong = wrong.length > 0 && !solved;

    useAssistantContext({ page: 'diagnostic', title: diagnostic.title, excerpt: `${diagnostic.summary} Symptômes : ${diagnostic.symptoms.join(' ')}` });

    const askHint = async () => {
        setBusy(true);
        try {
            const response = await sendJson<{ hints: string[] }>('POST', `/api/diagnostics/${diagnostic.slug}/indice`);
            setHints(response.hints);
        } catch (error) {
            notify((error as Error).message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const submit = async () => {
        if (choice === null) return;
        setBusy(true);
        try {
            const response = await sendJson<{ correct: boolean; attempts: number; answer: number | null; explanation: string | null; related: { label: string; href: string }[] }>('POST', `/api/diagnostics/${diagnostic.slug}/reponse`, { choice });
            setAttempts(response.attempts);
            if (response.correct) {
                setSolved(true);
                notify('Bien vu ! Diagnostic enregistré dans tes résultats.');
            } else {
                setWrong((items) => [...items, choice]);
            }
            if (response.explanation) {
                setAnswer(response.answer);
                setExplanation(response.explanation);
                setRelated(response.related);
            }
        } catch (error) {
            notify((error as Error).message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
                <Link href="/diagnostic" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-3.5" aria-hidden /> Tous les exercices
                </Link>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-warn/12 text-warn">
                        <Stethoscope className="size-4" aria-hidden />
                    </span>
                    <span className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">Défi Abòrò</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', difficultyStyle[diagnostic.difficulty])}>{diagnostic.difficulty}</span>
                </div>
                <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{diagnostic.title}</h1>
                <p className="mt-3 text-lg text-muted-foreground">{diagnostic.summary}</p>

                <section className="mt-8" aria-labelledby="symptomes">
                    <h2 id="symptomes" className="font-display text-xl font-semibold">1. Les symptômes</h2>
                    <ul className="mt-3 space-y-2">
                        {diagnostic.symptoms.map((symptom) => (
                            <li key={symptom} className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                                <Eye className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden /> {symptom}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mt-8" aria-labelledby="observations">
                    <h2 id="observations" className="font-display text-xl font-semibold">2. Ce que l’on observe</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Sorties de commandes et extraits de capture (illustratifs, souvent simplifiés).</p>
                    {!allowed && diagnostic.observations_total > diagnostic.observations.length && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-warn">
                            <Lock className="size-4" aria-hidden /> {diagnostic.observations_total - diagnostic.observations.length} autre(s) observation(s) disponibles avec un compte gratuit.
                        </p>
                    )}
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {diagnostic.observations.map((observation) => {
                            const Icon = icons[observation.kind];
                            return (
                                <figure key={observation.title} className={cn('overflow-hidden rounded-2xl border border-line bg-overlay', observation.lines.join('').length > 160 && 'md:col-span-2')}>
                                    <figcaption className="flex items-center gap-2 border-b border-line bg-night-850 px-4 py-2 text-xs font-medium">
                                        <Icon className="size-3.5 text-signal" aria-hidden /> {observation.title}
                                    </figcaption>
                                    <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-foreground/90 scrollbar-thin">{observation.lines.join('\n')}</pre>
                                </figure>
                            );
                        })}
                    </div>
                </section>

                {!allowed ? (
                    <div className="mt-8">
                        <LabGate access={access} labHref={`/diagnostic/${diagnostic.slug}`} />
                    </div>
                ) : (
                    <>
                        <section className="mt-8" aria-labelledby="indices">
                            <h2 id="indices" className="font-display text-xl font-semibold">3. Indices (si tu en as besoin)</h2>
                            <ol className="mt-3 space-y-2">
                                {hints.map((hint, index) => (
                                    <motion.li
                                        key={hint}
                                        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/8 px-4 py-3 text-sm"
                                    >
                                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                                        <span>
                                            <strong className="text-warn">Indice {index + 1} : </strong>
                                            {hint}
                                        </span>
                                    </motion.li>
                                ))}
                            </ol>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {hints.length < diagnostic.hints_total && !solved && (
                                    <button type="button" disabled={busy} onClick={askHint} className="inline-flex items-center gap-2 rounded-xl border border-warn/40 px-4 py-2 text-sm font-medium text-warn hover:bg-warn/10 disabled:opacity-50">
                                        <Lightbulb className="size-4" aria-hidden /> {hints.length === 0 ? 'Afficher un indice' : 'Indice suivant'} ({hints.length}/{diagnostic.hints_total})
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => assistant.open('Peux-tu me donner une piste sans me donner la réponse ?')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-signal/40 px-4 py-2 text-sm font-medium text-signal hover:bg-signal/10"
                                >
                                    <MessageCircleQuestion className="size-4" aria-hidden /> Demander une piste à l’assistant
                                </button>
                            </div>
                        </section>

                        <section className="mt-8" aria-labelledby="cause">
                            <h2 id="cause" className="font-display text-xl font-semibold">4. Quelle est la cause la plus plausible ?</h2>
                            <fieldset className="mt-3 space-y-2" disabled={solved || busy}>
                                <legend className="sr-only">Choisis une cause</legend>
                                {diagnostic.choices.map((text, index) => {
                                    const tried = wrong.includes(index);
                                    const isAnswer = answer === index;
                                    return (
                                        <label
                                            key={text}
                                            className={cn(
                                                'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition',
                                                isAnswer && 'border-ok/60 bg-ok/10',
                                                tried && 'border-danger/50 bg-danger/8 opacity-80',
                                                !isAnswer && !tried && (choice === index ? 'border-signal bg-signal/10' : 'border-line hover:border-signal/40'),
                                            )}
                                        >
                                            <input type="radio" name="cause" className="mt-0.5 size-4 accent-[var(--color-signal)]" checked={choice === index} onChange={() => setChoice(index)} disabled={tried} />
                                            <span className="flex-1">{text}</span>
                                            {tried && <CircleX className="size-4 text-danger" aria-label="Réponse écartée" />}
                                            {isAnswer && <CircleCheck className="size-4 text-ok" aria-label="Bonne réponse" />}
                                        </label>
                                    );
                                })}
                            </fieldset>
                            {!solved && (
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <button type="button" onClick={submit} disabled={busy || choice === null || wrong.includes(choice)} className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-on-accent disabled:opacity-40">
                                        Valider mon diagnostic
                                    </button>
                                    {lastWrong && !revealed && (
                                        <p className="text-sm text-danger" role="status">
                                            Ce n’est pas la cause la plus plausible. Réexamine les observations{hints.length < diagnostic.hints_total ? ' ou demande un indice' : ''}.
                                        </p>
                                    )}
                                    {attempts > 0 && <span className="text-xs text-muted-foreground">Essais : {attempts}</span>}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {revealed && (
                    <motion.section
                        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 rounded-3xl border border-ok/40 bg-ok/6 p-5 sm:p-6"
                        aria-labelledby="correction"
                        role="status"
                    >
                        <h2 id="correction" className="flex items-center gap-2 font-display text-xl font-semibold text-ok">
                            <CircleCheck className="size-5" aria-hidden /> Correction
                        </h2>
                        {answer !== null && <p className="mt-2 font-medium">{diagnostic.choices[answer]}</p>}
                        {!solved && <p className="mt-1 text-sm text-muted-foreground">Correction affichée après deux essais : prends le temps de relire chaque observation à sa lumière.</p>}
                        <p className="prose-net mt-3">{renderInline(explanation ?? '')}</p>
                        {related.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {related.map((link) => (
                                    <Link key={link.href} href={link.href} className="rounded-full border border-line px-3 py-1 text-sm hover:border-signal/60 hover:text-signal">
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </motion.section>
                )}

                <nav aria-label="Exercices voisins" className="mt-10 flex justify-between border-t border-line pt-6">
                    {previous ? (
                        <Link href={`/diagnostic/${previous}`} className="inline-flex items-center gap-1 text-sm hover:text-signal">
                            <ArrowLeft className="size-4" aria-hidden /> Exercice précédent
                        </Link>
                    ) : (
                        <span />
                    )}
                    {next && (
                        <Link href={`/diagnostic/${next}`} className="inline-flex items-center gap-1 text-sm hover:text-signal">
                            Exercice suivant <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    )}
                </nav>
            </div>
        </>
    );
}
