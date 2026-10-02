import { Head, Link } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, Compass, FlaskConical, Heart, Lightbulb, PlayCircle, Stethoscope, Trophy } from 'lucide-react';
import { StudentShell } from '@/components/learning/student-shell';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

type SessionItem = { id: number; lab_type: string; lab_slug: string; title: string; href: string | null; status: string; progress: number; current_step: number; total_steps: number; last_activity_at: string };
type Props = {
    stats: { lessons_started: number; labs_started: number; labs_completed: number; labs_total: number; diagnostics_solved: number; diagnostics_total: number; quiz_attempts: number; quiz_average: number | null };
    resume: SessionItem | null;
    recentLabs: SessionItem[];
    recentResults: { id: number; quiz: { title: string; href: string | null }; score: number; total: number; percent: number; date: string }[];
    favorites: { type: string; slug: string; title: string; href: string | null }[];
    recommendations: { kind: string; title: string; href: string; reason: string }[];
};

export default function Dashboard({ stats, resume, recentLabs, recentResults, favorites, recommendations }: Props) {
    const user = useAuth();
    const firstName = user?.name.split(' ')[0] ?? '';
    const isNew = stats.labs_started === 0 && stats.quiz_attempts === 0;

    return (
        <StudentShell title={`Bonjour ${firstName}`} description={isNew ? 'Bienvenue dans la communauté Abòrò ! Voici par où commencer.' : 'Reprends là où tu t’es arrêté. Abòrò, on continue !'}>
            <Head title="Mon tableau de bord" />

            {/* Action principale */}
            {resume ? (
                <Link href={resume.href ?? '#'} className="group flex flex-col gap-4 rounded-3xl border border-signal/40 bg-gradient-to-br from-signal/12 to-gold/8 p-5 transition hover:border-signal sm:flex-row sm:items-center sm:p-6">
                    <PlayCircle className="size-12 shrink-0 text-signal" aria-hidden />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tracking-wide text-signal uppercase">Reprendre</p>
                        <p className="font-display text-xl font-semibold">{resume.title}</p>
                        <div className="mt-2 flex items-center gap-3">
                            <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-night-700">
                                <div className="h-full rounded-full bg-signal" style={{ width: `${resume.progress}%` }} />
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {resume.lab_type === 'scenario' ? `Étape ${resume.current_step + 1}/${resume.total_steps}` : 'Diagnostic en cours'} · {timeAgo(resume.last_activity_at)}
                            </span>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent">
                        Continuer <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </span>
                </Link>
            ) : isNew ? (
                <div className="rounded-3xl border border-signal/40 bg-gradient-to-br from-signal/12 to-gold/8 p-6">
                    <p className="font-display text-xl font-semibold">Tu n’as pas encore commencé de TP.</p>
                    <p className="mt-1 text-muted-foreground">Choisis une première expérience pour découvrir comment les paquets circulent sur Internet.</p>
                    <Link href="/laboratoire/acces-internet" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent">
                        <PlayCircle className="size-4" aria-hidden /> Lancer « Accéder à Internet depuis chez soi »
                    </Link>
                </div>
            ) : null}

            {/* Indicateurs simples */}
            <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat icon={FlaskConical} label="TP terminés" value={`${stats.labs_completed} / ${stats.labs_total}`} progress={stats.labs_total ? stats.labs_completed / stats.labs_total : 0} />
                <Stat icon={Stethoscope} label="Diagnostics résolus" value={`${stats.diagnostics_solved} / ${stats.diagnostics_total}`} progress={stats.diagnostics_total ? stats.diagnostics_solved / stats.diagnostics_total : 0} />
                <Stat icon={Trophy} label="Moyenne aux quiz" value={stats.quiz_average === null ? '—' : `${stats.quiz_average} %`} hint={`${stats.quiz_attempts} tentative(s)`} />
                <Stat icon={Compass} label="Chapitres consultés" value={String(stats.lessons_started)} />
            </dl>

            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <section className="rounded-3xl border border-line bg-surface p-5">
                    <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                        <Lightbulb className="size-5 text-warn" aria-hidden /> Prochaines étapes conseillées
                    </h2>
                    {recommendations.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">Tu as tout exploré ! Refais un TP dans une autre situation ou améliore tes scores aux quiz.</p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {recommendations.map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href} className="group flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:border-signal/50">
                                        <span className="flex-1">
                                            <span className="block font-medium group-hover:text-signal">{item.title}</span>
                                            <span className="block text-xs text-muted-foreground">{item.reason}</span>
                                        </span>
                                        <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-signal" aria-hidden />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="rounded-3xl border border-line bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                            <Trophy className="size-5 text-warn" aria-hidden /> Résultats récents
                        </h2>
                        <Link href="/app/mes-resultats" className="text-sm text-signal hover:underline">
                            Tout voir
                        </Link>
                    </div>
                    {recentResults.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">Tes scores de quiz apparaîtront ici. Chaque leçon se termine par un quiz.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-line/60">
                            {recentResults.map((result) => (
                                <li key={result.id} className="flex items-center gap-3 py-2.5 text-sm">
                                    <span className={cn('w-14 shrink-0 rounded-lg py-1 text-center font-mono text-xs font-semibold', result.percent >= 60 ? 'bg-ok/12 text-ok' : 'bg-warn/12 text-warn')}>
                                        {result.score}/{result.total}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{result.quiz.href ? <Link href={result.quiz.href} className="hover:text-signal">{result.quiz.title}</Link> : result.quiz.title}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(result.date)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section className="rounded-3xl border border-line bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                            <FlaskConical className="size-5 text-signal" aria-hidden /> Derniers TP
                        </h2>
                        <Link href="/app/mon-historique" className="text-sm text-signal hover:underline">
                            Historique
                        </Link>
                    </div>
                    {recentLabs.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">Aucun TP pour l’instant.</p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {recentLabs.map((lab) => (
                                <li key={lab.id} className="flex items-center gap-3 text-sm">
                                    {lab.status === 'completed' ? <CheckCircle2 className="size-4 shrink-0 text-ok" aria-label="Terminé" /> : <span className="size-4 shrink-0 rounded-full border-2 border-signal" aria-label="En cours" />}
                                    <span className="min-w-0 flex-1 truncate">{lab.href ? <Link href={lab.href} className="hover:text-signal">{lab.title}</Link> : lab.title}</span>
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{lab.progress} %</span>
                                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{formatDateTime(lab.last_activity_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="rounded-3xl border border-line bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                            <Heart className="size-5 text-danger" aria-hidden /> Mes favoris
                        </h2>
                        <Link href="/app/mes-favoris" className="text-sm text-signal hover:underline">
                            Tout voir
                        </Link>
                    </div>
                    {favorites.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">Ajoute une leçon, une fiche ou un TP en favori avec le bouton ♡ pour le retrouver ici.</p>
                    ) : (
                        <ul className="mt-3 flex flex-wrap gap-2">
                            {favorites.map((favorite) => (
                                <li key={`${favorite.type}-${favorite.slug}`}>
                                    <Link href={favorite.href ?? '#'} className="inline-flex rounded-full border border-line px-3 py-1.5 text-sm hover:border-signal/60 hover:text-signal">
                                        {favorite.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </StudentShell>
    );
}

function Stat({ icon: Icon, label, value, hint, progress }: { icon: typeof Trophy; label: string; value: string; hint?: string; progress?: number }) {
    return (
        <div className="rounded-2xl border border-line bg-surface p-4">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-4" aria-hidden /> {label}
            </dt>
            <dd className="mt-1.5 font-display text-2xl font-semibold">{value}</dd>
            {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
            {progress !== undefined && (
                <dd className="mt-2 h-1.5 overflow-hidden rounded-full bg-night-700">
                    <span className="block h-full rounded-full bg-gradient-to-r from-signal to-ok" style={{ width: `${Math.round(progress * 100)}%` }} />
                </dd>
            )}
        </div>
    );
}
