import { Head, Link } from '@inertiajs/react';
import { Stethoscope, Trophy } from 'lucide-react';
import { EmptyState, StatusPill } from '@/components/admin/ui';
import { StudentShell } from '@/components/learning/student-shell';
import { formatDateTime, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

type Attempt = { id: number; slug: string; quiz: { title: string; href: string | null }; score: number; total: number; percent: number; duration: number | null; date: string };
type Diag = { id: number; diagnostic: { title: string; href: string | null }; status: string; attempts: number; hints: number; date: string };

export default function Results({ attempts, diagnostics, average }: { attempts: Attempt[]; diagnostics: Diag[]; average: number | null }) {
    return (
        <StudentShell title="Mes résultats" description={average === null ? 'Tes scores apparaîtront ici après ton premier quiz.' : `Moyenne générale aux quiz : ${average} %`}>
            <Head title="Mes résultats" />
            <div className="space-y-6">
                <section className="rounded-3xl border border-line bg-surface">
                    <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-lg font-semibold">
                        <Trophy className="size-5 text-warn" aria-hidden /> Quiz
                    </h2>
                    {attempts.length === 0 ? (
                        <EmptyState title="Aucun quiz réalisé">
                            Chaque leçon se termine par un quiz.{' '}
                            <Link href="/quiz" className="text-signal hover:underline">
                                Voir tous les quiz
                            </Link>
                        </EmptyState>
                    ) : (
                        <ul className="divide-y divide-line/60">
                            {attempts.map((attempt) => (
                                <li key={attempt.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                    <span className={cn('w-16 shrink-0 rounded-lg py-1 text-center font-mono text-xs font-semibold', attempt.percent >= 60 ? 'bg-ok/12 text-ok' : 'bg-warn/12 text-warn')}>
                                        {attempt.score}/{attempt.total}
                                    </span>
                                    <span className="min-w-0 flex-1">{attempt.quiz.href ? <Link href={attempt.quiz.href} className="font-medium hover:text-signal">{attempt.quiz.title}</Link> : attempt.quiz.title}</span>
                                    <span className="text-xs text-muted-foreground">{formatDuration(attempt.duration)}</span>
                                    <span className="w-36 text-right text-xs text-muted-foreground">{formatDateTime(attempt.date)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="rounded-3xl border border-line bg-surface">
                    <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-lg font-semibold">
                        <Stethoscope className="size-5 text-danger" aria-hidden /> Diagnostics
                    </h2>
                    {diagnostics.length === 0 ? (
                        <EmptyState title="Aucun diagnostic tenté">
                            <Link href="/diagnostic" className="text-signal hover:underline">
                                Choisir un exercice
                            </Link>
                        </EmptyState>
                    ) : (
                        <ul className="divide-y divide-line/60">
                            {diagnostics.map((item) => (
                                <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                    <StatusPill status={item.status === 'completed' ? 'completed' : 'in_progress'} />
                                    <span className="min-w-0 flex-1">{item.diagnostic.href ? <Link href={item.diagnostic.href} className="font-medium hover:text-signal">{item.diagnostic.title}</Link> : item.diagnostic.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {item.attempts} essai(s) · {item.hints} indice(s)
                                    </span>
                                    <span className="w-36 text-right text-xs text-muted-foreground">{formatDateTime(item.date)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </StudentShell>
    );
}
