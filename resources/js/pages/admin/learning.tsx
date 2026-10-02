import { Head, Link } from '@inertiajs/react';
import { Heart, Search, SearchX, ThumbsUp } from 'lucide-react';
import { RankedBars, SplitBar } from '@/components/admin/charts';
import { PeriodFilter } from '@/components/admin/period-filter';
import type { PeriodInfo } from '@/components/admin/period-filter';
import { AdminPage, Definition, Panel, Table } from '@/components/admin/ui';
import { formatDuration } from '@/lib/format';

type Learning = {
    popularity: { lessons: { slug: string; title: string; value: number }[]; protocols: { slug: string; title: string; value: number }[] };
    labs: { slug: string; title: string; started: number; completed: number; rate: number; abandoned: number; common_stop: { steps_seen: number; count: number; total: number } | null; median_active: number | null }[];
    quizzes: { slug: string; title: string; attempts: number; students: number; average: number; median: number | null }[];
    favorites: { type: string; slug: string; title: string; value: number }[];
    satisfaction: { type: string; slug: string; title: string; useful: number; unclear: number }[];
    searches: { query: string; value: number }[];
    empty_searches: { query: string; value: number }[];
};

export default function LearningAnalytics({ period, learning }: { period: PeriodInfo; learning: Learning }) {
    return (
        <AdminPage title="Apprentissage et engagement" description="Popularité, complétion, satisfaction déclarée et résultats sont présentés séparément : un contenu très consulté n’est pas forcément le mieux compris.">
            <Head title="Apprentissage" />
            <PeriodFilter period={period} exports={[{ href: '/admin/export/contenus', label: 'TP (CSV)' }]} />

            <h2 className="font-display text-lg font-semibold">1. Popularité</h2>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title="Leçons les plus consultées">
                    <RankedBars items={learning.popularity.lessons.map((row) => ({ key: row.slug, label: row.title, value: row.value }))} />
                </Panel>
                <Panel title="Fiches protocoles les plus consultées">
                    <RankedBars items={learning.popularity.protocols.map((row) => ({ key: row.slug, label: row.title, value: row.value }))} color="var(--color-chart-2)" />
                </Panel>
            </div>

            <h2 className="font-display text-lg font-semibold">2. Complétion des TP</h2>
            <Panel padded={false} title="TP commencés sur la période" description="Abandon : séance non terminée et inactive depuis plus de 7 jours. « Arrêt fréquent » : nombre d’étapes vues le plus courant chez ceux qui abandonnent.">
                <Table head={['TP', 'Commencés', 'Terminés', 'Complétion', 'Abandons', 'Arrêt fréquent', 'Temps actif médian']} empty={learning.labs.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Aucun TP commencé sur la période.</p> : null}>
                    {learning.labs.map((lab) => (
                        <tr key={lab.slug}>
                            <td className="font-medium">
                                <Link href={`/lecons/${lab.slug}`} className="hover:text-signal">
                                    {lab.title}
                                </Link>
                            </td>
                            <td className="tabular-nums">{lab.started}</td>
                            <td className="tabular-nums">{lab.completed}</td>
                            <td>
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-night-700">
                                        <span className="block h-full rounded-full bg-[var(--color-chart-1)]" style={{ width: `${lab.rate}%` }} />
                                    </span>
                                    <span className="tabular-nums">{lab.rate} %</span>
                                </div>
                            </td>
                            <td className="tabular-nums">{lab.abandoned}</td>
                            <td className="text-muted-foreground">{lab.common_stop ? `après ${lab.common_stop.steps_seen}/${lab.common_stop.total} étapes (${lab.common_stop.count})` : '—'}</td>
                            <td>{formatDuration(lab.median_active)}</td>
                        </tr>
                    ))}
                </Table>
            </Panel>

            <h2 className="font-display text-lg font-semibold">3. Résultats aux quiz</h2>
            <Panel padded={false}>
                <Table head={['Quiz', 'Tentatives', 'Étudiants', 'Moyenne', 'Médiane']} empty={learning.quizzes.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Aucun quiz réalisé sur la période.</p> : null}>
                    {learning.quizzes.map((quiz) => (
                        <tr key={quiz.slug}>
                            <td className="font-medium">{quiz.title}</td>
                            <td className="tabular-nums">{quiz.attempts}</td>
                            <td className="tabular-nums">{quiz.students}</td>
                            <td className="tabular-nums">{quiz.average} %</td>
                            <td className="tabular-nums">{quiz.median ?? '—'} %</td>
                        </tr>
                    ))}
                </Table>
            </Panel>

            <h2 className="font-display text-lg font-semibold">4. Satisfaction déclarée et favoris</h2>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title={<span className="flex items-center gap-2"><ThumbsUp className="size-4" aria-hidden /> Évaluations (tout l’historique)</span>} description="Une évaluation par étudiant et par contenu (modifiable).">
                    {learning.satisfaction.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucune évaluation pour l’instant.</p>
                    ) : (
                        <>
                            <ul className="mb-3 flex gap-4 text-xs text-muted-foreground">
                                <li className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3.5 rounded-full bg-[var(--color-chart-1)]" aria-hidden /> Utile</li>
                                <li className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3.5 rounded-full bg-[var(--color-chart-3)]" aria-hidden /> Pas encore clair</li>
                            </ul>
                            <ul className="space-y-3">
                                {learning.satisfaction.map((row) => (
                                    <li key={`${row.type}-${row.slug}`} className="space-y-1 text-sm">
                                        <div className="flex justify-between gap-3">
                                            <span className="truncate">{row.title}</span>
                                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                                {row.useful} / {row.unclear}
                                            </span>
                                        </div>
                                        <SplitBar a={row.useful} b={row.unclear} labelA="Utile" labelB="Pas encore clair" colorA="var(--color-chart-1)" colorB="var(--color-chart-3)" />
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </Panel>
                <Panel title={<span className="flex items-center gap-2"><Heart className="size-4" aria-hidden /> Contenus les plus mis en favori</span>}>
                    <RankedBars items={learning.favorites.map((row) => ({ key: `${row.type}-${row.slug}`, label: row.title, value: row.value }))} color="var(--color-chart-2)" empty="Aucun favori pour l’instant." />
                </Panel>
            </div>

            <h2 className="font-display text-lg font-semibold">5. Recherche</h2>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title={<span className="flex items-center gap-2"><Search className="size-4" aria-hidden /> Termes les plus recherchés</span>}>
                    <RankedBars items={learning.searches.map((row) => ({ key: row.query, label: <code className="font-mono">{row.query}</code>, value: row.value }))} />
                </Panel>
                <Panel title={<span className="flex items-center gap-2"><SearchX className="size-4" aria-hidden /> Recherches sans résultat</span>} description="Des pistes directes pour de nouvelles fiches ou de nouveaux termes.">
                    <RankedBars items={learning.empty_searches.map((row) => ({ key: row.query, label: <code className="font-mono">{row.query}</code>, value: row.value }))} color="var(--color-chart-3)" empty="Aucune recherche infructueuse." />
                </Panel>
            </div>
            <Definition>Les requêtes ressemblant à une donnée personnelle (adresse e-mail, longue suite de chiffres) sont masquées avant enregistrement. Ces indicateurs décrivent des usages : une corrélation (ex. favoris et scores) ne prouve pas l’efficacité pédagogique d’un contenu.</Definition>
        </AdminPage>
    );
}
