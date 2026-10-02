import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { EmptyState, StatusPill } from '@/components/admin/ui';
import { formatDateTime, formatDuration } from '@/lib/format';
import type { LessonSummary } from '@/types/content';

type Session = { id: number; variant: string | null; status: string; progress: number; current_step: number; total_steps: number; active_seconds: number; started_at: string; completed_at: string | null };
type Attempt = { id: number; score: number; total: number; percent: number; date: string };

export default function LabResults({ lesson, sessions, quiz, attempts }: { lesson: LessonSummary; sessions: Session[]; quiz: { slug: string; title: string } | null; attempts: Attempt[] }) {
    return (
        <>
            <Head title={`Résultats — ${lesson.title}`} />
            <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
                <Link href={`/laboratoire/${lesson.slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-4" aria-hidden /> Retour au TP
                </Link>
                <h1 className="font-display text-3xl font-semibold">Mes résultats</h1>
                <p className="text-muted-foreground">{lesson.title}</p>

                <section className="rounded-2xl border border-line bg-surface">
                    <h2 className="border-b border-line px-5 py-3 font-display font-semibold">Séances de TP</h2>
                    {sessions.length === 0 ? (
                        <EmptyState title="Aucune séance pour l’instant">Lance le TP : ta progression s’enregistre automatiquement.</EmptyState>
                    ) : (
                        <ul className="divide-y divide-line/60">
                            {sessions.map((session) => (
                                <li key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                    <StatusPill status={session.status === 'completed' ? 'completed' : 'in_progress'} />
                                    <span className="font-medium">{session.variant ? `Situation « ${session.variant} »` : 'Situation principale'}</span>
                                    <span className="text-muted-foreground">
                                        {session.progress} % · temps actif {formatDuration(session.active_seconds)}
                                    </span>
                                    <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(session.completed_at ?? session.started_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {quiz && (
                    <section className="rounded-2xl border border-line bg-surface">
                        <h2 className="flex items-center gap-2 border-b border-line px-5 py-3 font-display font-semibold">
                            <Trophy className="size-4 text-warn" aria-hidden /> {quiz.title}
                        </h2>
                        {attempts.length === 0 ? (
                            <EmptyState title="Pas encore de tentative">Le quiz se trouve en bas de la page du TP.</EmptyState>
                        ) : (
                            <ul className="divide-y divide-line/60">
                                {attempts.map((attempt) => (
                                    <li key={attempt.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                                        <span className="font-mono font-semibold">
                                            {attempt.score}/{attempt.total}
                                        </span>
                                        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-night-700">
                                            <span className={attempt.percent >= 60 ? 'block h-full bg-ok' : 'block h-full bg-warn'} style={{ width: `${attempt.percent}%` }} />
                                        </span>
                                        <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(attempt.date)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </div>
        </>
    );
}
