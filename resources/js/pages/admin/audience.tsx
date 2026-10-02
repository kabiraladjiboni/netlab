import { Head } from '@inertiajs/react';
import { Globe2, Info } from 'lucide-react';
import { ColumnChart, Kpi, LineChart, RankedBars, useSeries } from '@/components/admin/charts';
import { PeriodFilter } from '@/components/admin/period-filter';
import type { PeriodInfo } from '@/components/admin/period-filter';
import { AdminPage, Definition, Panel } from '@/components/admin/ui';
import { countryFlag, formatNumber } from '@/lib/format';
import type { Overview, Presence, SeriesMap } from './dashboard';

type Geography = {
    available: boolean;
    sessions_total: number;
    sessions_unknown: number;
    countries: { code: string; name: string; sessions: number; students: number; share: number }[];
    weekly: { countries: { code: string; name: string }[]; rows: { week: string; values: Record<string, number> }[] };
    declared: { code: string; name: string; students: number }[];
};

const VIEWS = [{ key: 'page_views', label: 'Pages vues' }];
const SESSIONS = [
    { key: 'active_sessions', label: 'Sessions suivies' },
    { key: 'active_users', label: 'Étudiants actifs' },
];

export default function Audience({ period, presence, overview, series, hourly, geography, retentionDays, geoHeader }: { period: PeriodInfo; presence: Presence; overview: Overview; series: SeriesMap; hourly: { hour: number; value: number }[]; geography: Geography; retentionDays: number; geoHeader: boolean }) {
    const views = useSeries(series, VIEWS);
    const sessions = useSeries(series, SESSIONS);
    const unknownShare = geography.sessions_total > 0 ? Math.round((geography.sessions_unknown / geography.sessions_total) * 100) : 0;

    return (
        <AdminPage title="Audience" description={`Présence, fréquentation et pays estimés. Données de mesure conservées ${retentionDays} jours, sans adresse IP.`}>
            <Head title="Audience" />
            <PeriodFilter period={period} exports={[{ href: '/admin/export/pays', label: 'Pays (CSV)' }]} />

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi tone="live" label="Actives maintenant" value={formatNumber(presence.active_sessions)} hint={`Fenêtre : ${presence.window_minutes} min. Dont ${presence.active_students} étudiant(s) connecté(s).`} />
                <Kpi label="Étudiants vus (30 dernières min)" value={formatNumber(presence.recent_students)} hint="D’après la dernière activité enregistrée sur le compte." />
                <Kpi label="Visiteurs uniques" value={formatNumber(overview.unique_visitors)} hint="Somme des visiteurs uniques de chaque jour (empreinte renouvelée quotidiennement), consentants uniquement." />
                <Kpi label="Pages vues" value={formatNumber(overview.page_views)} hint="Tous visiteurs, y compris sans consentement (compteur anonyme)." />
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title="Pages vues par jour">
                    <LineChart labels={views.labels} series={views.series} caption="Pages vues par jour" />
                </Panel>
                <Panel title="Sessions et étudiants actifs par jour" description="Une session suivie = visiteur ayant accepté la mesure, ou étudiant connecté.">
                    <LineChart labels={sessions.labels} series={sessions.series} caption="Sessions et étudiants actifs par jour" />
                </Panel>
            </div>

            <Panel title="Heures d’activité" description="Pages vues selon l’heure du serveur, cumulées sur la période.">
                <ColumnChart labels={hourly.map((h) => `${h.hour}h`)} values={hourly.map((h) => h.value)} caption="Pages vues par heure de la journée" />
            </Panel>

            <Panel
                title={<span className="flex items-center gap-2"><Globe2 className="size-4 text-signal" aria-hidden /> Audience géographique (estimation)</span>}
                description="Pays déduit de l’adresse IP au début de chaque session consentie, puis l’adresse est oubliée. VPN, relais et réseaux mobiles peuvent fausser le résultat : ce n’est jamais une localisation exacte."
            >
                {!geography.available ? (
                    <div className="flex gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
                        <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                        <div>
                            <p className="font-semibold">Les données géographiques ne sont pas encore disponibles.</p>
                            <p className="mt-1 text-muted-foreground">
                                Importe une base gratuite « IP → pays » (fichier CSV DB-IP Lite) avec <code className="font-mono">php artisan netlab:geoip-import fichier.csv</code>, ou configure <code className="font-mono">NETLAB_GEO_HEADER</code> si un proxy de confiance (Cloudflare…) fournit le pays.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <div>
                            <p className="mb-3 text-sm text-muted-foreground">
                                {formatNumber(geography.sessions_total)} session(s) suivie(s) · pays non identifié : {formatNumber(geography.sessions_unknown)} ({unknownShare} %)
                            </p>
                            <RankedBars
                                items={geography.countries.slice(0, 15).map((country) => ({
                                    key: country.code,
                                    label: (
                                        <>
                                            <span aria-hidden>{countryFlag(country.code)}</span> {country.name}
                                        </>
                                    ),
                                    value: country.sessions,
                                    extra: <span className="ml-2 text-xs font-normal text-muted-foreground">{country.share} % · {country.students} étudiant(s)</span>,
                                }))}
                                empty="Aucun pays identifié sur cette période."
                            />
                        </div>
                        <div className="space-y-5">
                            {geography.weekly.rows.length > 0 && (
                                <div>
                                    <p className="mb-2 text-sm font-semibold">Évolution hebdomadaire (5 premiers pays)</p>
                                    <div className="overflow-x-auto scrollbar-thin">
                                        <table className="w-full text-left text-xs">
                                            <thead className="text-muted-foreground">
                                                <tr>
                                                    <th className="py-1.5 pr-3 font-medium">Semaine</th>
                                                    {geography.weekly.countries.map((c) => (
                                                        <th key={c.code} className="px-2 py-1.5 text-right font-medium">
                                                            {countryFlag(c.code)} {c.code}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-line/50 tabular-nums">
                                                {geography.weekly.rows.map((row) => (
                                                    <tr key={row.week}>
                                                        <td className="py-1.5 pr-3 font-mono">{row.week}</td>
                                                        {geography.weekly.countries.map((c) => (
                                                            <td key={c.code} className="px-2 py-1.5 text-right">
                                                                {row.values[c.code] ?? 0}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="mb-2 text-sm font-semibold">Pays déclarés dans les profils</p>
                                <RankedBars items={geography.declared.map((c) => ({ key: c.code, label: `${countryFlag(c.code)} ${c.name}`, value: c.students }))} color="var(--color-chart-2)" empty="Aucun étudiant n’a renseigné de pays." />
                                <p className="mt-2 text-xs text-muted-foreground">Information facultative fournie par les étudiants, à distinguer de l’estimation par adresse IP.</p>
                            </div>
                        </div>
                    </div>
                )}
                {geoHeader && <p className="mt-4 text-xs text-muted-foreground">Source : en-tête du proxy de confiance configuré (NETLAB_GEO_HEADER).</p>}
            </Panel>

            <Definition>
                « Actif maintenant » repose sur des signaux réels : un affichage de page, ou un battement envoyé toutes les 60 s uniquement si l’onglet est visible et utilisé depuis moins de 2 min. Aucune liste nominative de personnes connectées n’est affichée.
            </Definition>
        </AdminPage>
    );
}
