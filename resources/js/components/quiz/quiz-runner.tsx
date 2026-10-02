import { ArrowDown, ArrowUp, CircleCheck, CircleX, RotateCcw, Trophy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { renderInline } from '@/components/content/rich-text';
import { usePreferences } from '@/hooks/use-preferences';
import { Link } from '@inertiajs/react';
import { loginHref, useAuth } from '@/hooks/use-auth';
import { sendJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Quiz, QuizQuestion } from '@/types/content';

function shuffled<T>(items: T[], seed: string): T[] {
    // Mélange déterministe par question : l'ordre ne change pas à chaque rendu.
    let state = Array.from(seed).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);
    const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

type Answer = number | number[] | string[] | Record<string, string> | null;

export function isCorrect(question: QuizQuestion, answer: Answer): boolean {
    switch (question.type) {
        case 'single':
            return answer === question.answer;
        case 'multiple': {
            const given = [...((answer as number[]) ?? [])].sort();
            const expected = [...question.answer].sort();
            return given.length === expected.length && given.every((value, index) => value === expected[index]);
        }
        case 'order':
            return JSON.stringify(answer) === JSON.stringify(question.items);
        case 'match': {
            const map = (answer as Record<string, string>) ?? {};
            return question.pairs.every((pair) => map[pair.left] === pair.right);
        }
    }
}

export function QuizRunner({ quiz, onComplete, compact = false }: { quiz: Quiz; onComplete?: (score: number, total: number) => void; compact?: boolean }) {
    const { reducedMotion } = usePreferences();
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState<Answer[]>(() => quiz.questions.map(() => null));
    const [checked, setChecked] = useState<boolean[]>(() => quiz.questions.map(() => false));
    const [finished, setFinished] = useState(false);
    const question = quiz.questions[index];
    const user = useAuth();
    const startedAt = useRef(Date.now());
    const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    const score = useMemo(() => quiz.questions.filter((q, i) => checked[i] && isCorrect(q, answers[i])).length, [quiz.questions, answers, checked]);

    const setAnswer = (value: Answer) => setAnswers((previous) => previous.map((item, i) => (i === index ? value : item)));
    const check = () => setChecked((previous) => previous.map((item, i) => (i === index ? true : item)));
    const next = () => {
        if (index < quiz.questions.length - 1) setIndex(index + 1);
        else {
            setFinished(true);
            onComplete?.(score, quiz.questions.length);
            if (user) {
                // Le score enregistré est recalculé par le serveur à partir des réponses.
                setSaved('saving');
                const payload = Object.fromEntries(quiz.questions.map((q, i) => [q.id, answers[i]]));
                sendJson('POST', '/api/quiz-attempts', { quiz: quiz.slug, answers: payload, duration: Math.round((Date.now() - startedAt.current) / 1000) })
                    .then(() => setSaved('saved'))
                    .catch(() => setSaved('error'));
            }
        }
    };
    const restart = () => {
        setIndex(0);
        setAnswers(quiz.questions.map(() => null));
        setChecked(quiz.questions.map(() => false));
        setFinished(false);
        setSaved('idle');
        startedAt.current = Date.now();
    };

    if (finished) {
        const ratio = score / quiz.questions.length;
        return (
            <div className="rounded-3xl border border-line bg-surface p-6 text-center sm:p-8" role="status">
                <Trophy className={cn('mx-auto size-10', ratio >= 0.7 ? 'text-ok' : 'text-warn')} aria-hidden />
                <p className="mt-3 font-display text-2xl font-semibold">
                    {score} / {quiz.questions.length}
                </p>
                <p className="mt-2 text-muted-foreground">
                    {ratio === 1
                        ? 'Parfait : tu maîtrises cette notion.'
                        : ratio >= 0.7
                          ? 'Très bien ! Relis les explications des questions manquées.'
                          : 'Pas encore : rejoue l’animation, puis réessaie. L’objectif est de comprendre, pas de mémoriser.'}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                    {!user ? (
                        <>
                            <Link href={loginHref()} className="text-signal hover:underline">
                                Connecte-toi
                            </Link>{' '}
                            pour enregistrer ton score dans tes résultats.
                        </>
                    ) : saved === 'saving' ? (
                        'Enregistrement du score…'
                    ) : saved === 'saved' ? (
                        <>
                            Score enregistré dans{' '}
                            <Link href="/app/mes-resultats" className="text-signal hover:underline">
                                tes résultats
                            </Link>
                            .
                        </>
                    ) : saved === 'error' ? (
                        <span className="text-danger">Le score n’a pas pu être enregistré.</span>
                    ) : null}
                </p>
                <button type="button" onClick={restart} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-signal/60">
                    <RotateCcw className="size-4" aria-hidden /> Recommencer
                </button>
            </div>
        );
    }

    const isChecked = checked[index];
    const answer = answers[index];
    const correct = isChecked && isCorrect(question, answer);
    const hasAnswer =
        question.type === 'single'
            ? answer !== null
            : question.type === 'multiple'
              ? Array.isArray(answer) && answer.length > 0
              : question.type === 'order'
                ? true
                : Object.keys((answer as Record<string, string>) ?? {}).length === question.pairs.length;

    return (
        <div className={cn('rounded-3xl border border-line bg-surface', compact ? 'p-4' : 'p-5 sm:p-7')}>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-mono">
                    Question {index + 1} / {quiz.questions.length}
                </span>
                <span>
                    {question.type === 'single' && 'Une seule réponse'}
                    {question.type === 'multiple' && 'Plusieurs réponses possibles'}
                    {question.type === 'order' && 'Remets dans l’ordre'}
                    {question.type === 'match' && 'Associe les éléments'}
                </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-night-700">
                <div className="h-full bg-signal transition-all" style={{ width: `${((index + (isChecked ? 1 : 0)) / quiz.questions.length) * 100}%` }} />
            </div>

            <AnimatePresence mode="wait">
                <motion.fieldset
                    key={question.id}
                    initial={reducedMotion ? false : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: -16 }}
                    transition={{ duration: 0.25 }}
                    className="mt-5"
                    disabled={isChecked}
                >
                    <legend className="font-display text-lg leading-snug font-semibold">{renderInline(question.prompt)}</legend>
                    {question.context && <p className="mt-2 text-sm text-muted-foreground">{renderInline(question.context)}</p>}

                    <div className="mt-4">
                        {question.type === 'single' && (
                            <ChoiceList question={question} multiple={false} value={answer as number | null} onChange={(value) => setAnswer(value as number)} checked={isChecked} />
                        )}
                        {question.type === 'multiple' && (
                            <ChoiceList question={question} multiple value={(answer as number[]) ?? []} onChange={(value) => setAnswer(value as number[])} checked={isChecked} />
                        )}
                        {question.type === 'order' && (
                            <OrderList question={question} value={(answer as string[]) ?? shuffled(question.items, question.id)} onChange={setAnswer} checked={isChecked} />
                        )}
                        {question.type === 'match' && (
                            <MatchList question={question} value={(answer as Record<string, string>) ?? {}} onChange={setAnswer} checked={isChecked} />
                        )}
                    </div>
                </motion.fieldset>
            </AnimatePresence>

            {isChecked && (
                <div
                    className={cn('mt-5 rounded-2xl border p-4 text-sm leading-relaxed', correct ? 'border-ok/40 bg-ok/8' : 'border-danger/40 bg-danger/8')}
                    role="status"
                    aria-live="polite"
                >
                    <p className={cn('mb-1 flex items-center gap-2 font-semibold', correct ? 'text-ok' : 'text-danger')}>
                        {correct ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
                        {correct ? 'Bonne réponse' : 'Pas tout à fait'}
                    </p>
                    {!correct && question.type === 'order' && <p className="mb-2 text-muted-foreground">Ordre attendu : {question.items.join(' → ')}</p>}
                    <p>{renderInline(question.explanation)}</p>
                </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
                {!isChecked ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (question.type === 'order' && answer === null) setAnswer(shuffled(question.items, question.id));
                            check();
                        }}
                        disabled={!hasAnswer}
                        className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-40"
                    >
                        Vérifier
                    </button>
                ) : (
                    <button type="button" onClick={next} className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110">
                        {index < quiz.questions.length - 1 ? 'Question suivante' : 'Voir mon résultat'}
                    </button>
                )}
            </div>
        </div>
    );
}

function ChoiceList({
    question,
    multiple,
    value,
    onChange,
    checked,
}: {
    question: Extract<QuizQuestion, { type: 'single' | 'multiple' }>;
    multiple: boolean;
    value: number | number[] | null;
    onChange: (value: number | number[]) => void;
    checked: boolean;
}) {
    const selected = (i: number) => (multiple ? (value as number[]).includes(i) : value === i);
    const expected = (i: number) => (question.type === 'single' ? question.answer === i : question.answer.includes(i));
    return (
        <ul className="space-y-2">
            {question.options.map((option, i) => {
                const isSelected = selected(i);
                return (
                    <li key={i}>
                        <label
                            className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition',
                                !checked && (isSelected ? 'border-signal bg-signal/10' : 'border-line hover:border-signal/40'),
                                checked && expected(i) && 'border-ok/60 bg-ok/10',
                                checked && isSelected && !expected(i) && 'border-danger/60 bg-danger/10',
                                checked && !isSelected && !expected(i) && 'border-line opacity-70',
                            )}
                        >
                            <input
                                type={multiple ? 'checkbox' : 'radio'}
                                name={`q-${question.id}`}
                                className="mt-0.5 size-4 accent-[var(--color-signal)]"
                                checked={isSelected}
                                onChange={() => {
                                    if (multiple) {
                                        const current = value as number[];
                                        onChange(current.includes(i) ? current.filter((item) => item !== i) : [...current, i]);
                                    } else onChange(i);
                                }}
                            />
                            <span>{renderInline(option)}</span>
                        </label>
                    </li>
                );
            })}
        </ul>
    );
}

function OrderList({ question, value, onChange, checked }: { question: Extract<QuizQuestion, { type: 'order' }>; value: string[]; onChange: (value: string[]) => void; checked: boolean }) {
    const move = (from: number, to: number) => {
        if (to < 0 || to >= value.length) return;
        const copy = [...value];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        onChange(copy);
    };
    return (
        <ol className="space-y-2">
            {value.map((item, i) => (
                <li
                    key={item}
                    className={cn(
                        'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm',
                        checked ? (question.items[i] === item ? 'border-ok/60 bg-ok/10' : 'border-danger/60 bg-danger/10') : 'border-line',
                    )}
                >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-night-700 font-mono text-xs">{i + 1}</span>
                    <span className="flex-1">{item}</span>
                    {!checked && (
                        <span className="flex gap-1">
                            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded-lg p-1.5 hover:bg-night-700 disabled:opacity-30" aria-label={`Monter « ${item} »`}>
                                <ArrowUp className="size-4" aria-hidden />
                            </button>
                            <button type="button" onClick={() => move(i, i + 1)} disabled={i === value.length - 1} className="rounded-lg p-1.5 hover:bg-night-700 disabled:opacity-30" aria-label={`Descendre « ${item} »`}>
                                <ArrowDown className="size-4" aria-hidden />
                            </button>
                        </span>
                    )}
                </li>
            ))}
        </ol>
    );
}

function MatchList({
    question,
    value,
    onChange,
    checked,
}: {
    question: Extract<QuizQuestion, { type: 'match' }>;
    value: Record<string, string>;
    onChange: (value: Record<string, string>) => void;
    checked: boolean;
}) {
    const rights = useMemo(() => shuffled(question.pairs.map((pair) => pair.right), question.id), [question]);
    return (
        <ul className="space-y-2.5">
            {question.pairs.map((pair) => {
                const ok = value[pair.left] === pair.right;
                return (
                    <li key={pair.left} className={cn('grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-center', checked ? (ok ? 'border-ok/60 bg-ok/10' : 'border-danger/60 bg-danger/10') : 'border-line')}>
                        <label htmlFor={`m-${question.id}-${pair.left}`} className="text-sm font-medium">
                            {pair.left}
                        </label>
                        <select
                            id={`m-${question.id}-${pair.left}`}
                            value={value[pair.left] ?? ''}
                            onChange={(event) => onChange({ ...value, [pair.left]: event.target.value })}
                            className="w-full rounded-lg border border-line bg-night-900 px-3 py-2 text-sm"
                        >
                            <option value="" disabled>
                                Choisir…
                            </option>
                            {rights.map((right) => (
                                <option key={right} value={right}>
                                    {right}
                                </option>
                            ))}
                        </select>
                        {checked && !ok && <p className="text-xs text-muted-foreground sm:col-span-2">Bonne association : {pair.right}</p>}
                    </li>
                );
            })}
        </ul>
    );
}
