import { Head, Link } from '@inertiajs/react';
import { Activity, ArrowRight, FileClock, FlaskConical, MessageSquareWarning, TriangleAlert } from 'lucide-react';
import { Kpi, LineChart, RankedBars, useSeries } from '@/components/admin/charts';
import { PeriodFilter } from '@/components/admin/period-filter';
import type { PeriodInfo } from '@/components/admin/period-filter';
import { AdminPage, Definition, Panel, StatusPill } from '@/components/admin/ui';
import { formatDuration, formatNumber, timeAgo } from '@/lib/format';

export type Overview = {
    students_total: number;
    signups: number;
    active_users: number;
    unique_visitors: number;
    page_views: number;
    lesson_views: number;
    labs_started: number;
    labs_completed: number;
    completion_rate: number | null;
    quizzes: number;
    quiz_average: number | null;
    diagnostics_solved: number;
    session_median_seconds: number | null;
    lab_median_seconds: number | null;
    ratings: number;
    feedback_open: number;
};
export type Presence = { window_minutes: number; active_sessions: number; active_students: number; recent_students: number; last_activity: string | null };
export type SeriesMap = Record<string, { day: string; value: number }[]>;

type Props = {
    period: PeriodInfo;
    overview: Overview;
    presence: Presence;
    series: SeriesMap;
    byCourse: { course: string; views: number; labs: number }[];
    feedback: { id: number; category: string; message: string; status: string; date: string }[];
    recentLogs: { id: number; action: string; label: string | null; actor: string; date: string }[];
    demoData: boolean;
};

const ACTIVITY = [
    { key: 'active_users', label: 'Étudiants actifs' },
    { key: 'active_sessions', label: 'Sessions suivies' },
];
const LABS = [
    { key: 'labs_started', label: 'TP commencés' },
    { key: 'labs_completed', label: 'TP terminés' },
];
const SIGNUPS = [{ key: 'signups', label: 'Inscriptions' }];

export default function AdminDashboard({ period, overview, presence, series, byCourse, feedback, recentLogs, demoData }: Props) {
    const activity = useSeries(series, ACTIVITY);
    const labs = useSeries(series, LABS);
    const signups = useSeries(series, SIGNUPS);

    return (
        <AdminPage title="Tableau de bord" description="Vue d’ensemble calculée uniquement à partir des données enregistrées. Chaque chiffre est défini sous sa tuile.">
            <Head title="Administration" />
            {demoData && (
                <p className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
                    <TriangleAlert className="size-4" aria-hidden /> Des comptes de démonstration (@demo.netlab.test) existent : les chiffres incluent des données fictives de développement.
                </p>
            )}
            <PeriodFilter period={period} exports={[{ href: '/admin/export/indicateurs', label: 'Exporter (CSV)' }]} />

            <section aria-label="Présence" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi tone="live" label="Sessions actives maintenant" value={formatNumber(presence.active_sessions)} hint={`Signal reçu dans les ${presence.window_minutes} dernières minutes (onglet visible et utilisé).`} />
                <Kpi label="Étudiants connectés actifs" value={formatNumber(presence.active_students)} hint="Parmi ces sessions, celles d’un compte connecté." />
                <Kpi label="Comptes étudiants" value={formatNumber(overview.students_total)} hint={`+${formatNumber(overview.signups)} inscrits sur la période.`} />
                <Kpi label="Étudiants actifs (période)" value={formatNumber(overview.active_users)} hint="Comptes ayant fait au moins une action sur la période." />
            </section>

            <section aria-label="Indicateurs" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Leçons consultées" value={formatNumber(overview.lesson_views)} hint="Au plus une consultation par leçon, par session et par jour." />
                <Kpi label="TP commencés / terminés" value={`${formatNumber(overview.labs_started)} / ${formatNumber(overview.labs_completed)}`} hint={overview.completion_rate === null ? 'Taux de complétion : —' : `Taux de complétion : ${overview.completion_rate} % des TP commencés sur la période.`} />
                <Kpi label="Quiz réalisés" value={formatNumber(overview.quizzes)} hint={overview.quiz_average === null ? 'Score moyen : —' : `Score moyen : ${overview.quiz_average} %`} />
                <Kpi label="Durée médiane" value={formatDuration(overview.session_median_seconds)} hint={`Par session suivie (≥ 2 signaux). Temps actif médian d’un TP terminé : ${formatDuration(overview.lab_median_seconds)}.`} />
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title="Activité quotidienne" description="Étudiants ayant agi chaque jour et sessions suivies (consentement ou compte).">
                    <LineChart labels={activity.labels} series={activity.series} caption="Activité quotidienne" />
                </Panel>
                <Panel title="Travaux pratiques" description="Séances démarrées et séances terminées (toutes les étapes vues), par jour.">
                    <LineChart labels={labs.labels} series={labs.series} caption="TP commencés et terminés par jour" />
                </Panel>
                <Panel title="Inscriptions">
                    <LineChart labels={signups.labels} series={signups.series} caption="Inscriptions par jour" height={170} />
                </Panel>
                <Panel title="Activité par cours" description="Consultations de leçons + TP lancés, regroupés par cours.">
                    <RankedBars items={byCourse.map((row) => ({ key: row.course, label: row.course, value: row.views + row.labs, extra: <span className="ml-2 text-xs font-normal text-muted-foreground">({row.views} vues · {row.labs} TP)</span> }))} />
                </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel
                    title={<span className="flex items-center gap-2"><MessageSquareWarning className="size-4 text-warn" aria-hidden /> Retours à traiter ({overview.feedback_open})</span>}
                    actions={<Link href="/admin/retours" className="text-sm text-signal hover:underline">Tout voir</Link>}
                    padded={false}
                >
                    {feedback.length === 0 ? (
                        <p className="p-5 text-sm text-muted-foreground">Aucun retour en attente.</p>
                    ) : (
                        <ul className="divide-y divide-line/60">
                            {feedback.map((item) => (
                                <li key={item.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                                    <StatusPill status={item.status} />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium">{item.category}</p>
                                        <p className="truncate text-muted-foreground">{item.message}</p>
                                    </div>
                                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.date)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
                <Panel title={<span className="flex items-center gap-2"><FileClock className="size-4" aria-hidden /> Dernières opérations</span>} actions={<Link href="/admin/journal" className="text-sm text-signal hover:underline">Journal</Link>} padded={false}>
                    {recentLogs.length === 0 ? (
                        <p className="p-5 text-sm text-muted-foreground">Aucune opération journalisée.</p>
                    ) : (
                        <ul className="divide-y divide-line/60">
                            {recentLogs.map((log) => (
                                <li key={log.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                                    <code className="rounded bg-night-800 px-1.5 py-0.5 font-mono text-xs">{log.action}</code>
                                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{log.label}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{log.actor} · {timeAgo(log.date)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link href="/admin/audience" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm hover:bg-night-800">
                    <Activity className="size-4" aria-hidden /> Audience et pays <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/admin/apprentissage" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm hover:bg-night-800">
                    <FlaskConical className="size-4" aria-hidden /> Apprentissage et engagement <ArrowRight className="size-4" aria-hidden />
                </Link>
            </div>
            <Definition>
                Un compte existant n’est pas un utilisateur actif, et une session ouverte n’est pas une présence réelle : « actif maintenant » ne compte que les sessions qui ont envoyé un signal d’activité récent. Les visiteurs ayant refusé la mesure d’audience ne sont comptés que dans les pages vues ({formatNumber(overview.page_views)} sur la période).
            </Definition>
        </AdminPage>
    );
}
