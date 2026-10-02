import { Head, Link, router } from '@inertiajs/react';
import { Check, EyeOff, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Kpi, SplitBar } from '@/components/admin/charts';
import { AdminPage, applyFilters, EmptyState, FilterSelect, Pagination, Panel, StatusPill, Table } from '@/components/admin/ui';
import type { Paginated } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/format';

type Content = { key: string; type: string; slug: string; title: string; href: string | null; favorites: number; useful: number; unclear: number; comments: number };
type Comment = { id: number; value: string; comment: string; status: string; author: string | null; date: string; subject: { title: string; href: string | null } };
type Props = { contents: Content[]; trend: { month: string; useful: number; unclear: number }[]; comments: Paginated<Comment>; moderation: string; totals: { useful: number; unclear: number; favorites: number; pending: number } };
const TYPES: Record<string, string> = { lesson: 'Leçon', protocol: 'Fiche', lab: 'TP' };

export default function Ratings({ contents, trend, comments, moderation, totals }: Props) {
    return (
        <AdminPage title="Favoris et évaluations" description="Une évaluation par étudiant et par contenu : les clics répétés modifient l’évaluation au lieu d’en ajouter une. Satisfaction déclarée ≠ compréhension mesurée.">
            <Head title="Évaluations" />
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="« Utile »" value={totals.useful} />
                <Kpi label="« Pas encore clair »" value={totals.unclear} />
                <Kpi label="Favoris" value={totals.favorites} />
                <Kpi label="Commentaires à modérer" value={totals.pending} />
            </section>
            <Panel padded={false} title="Par contenu">
                <Table head={['Contenu', 'Type', 'Favoris', 'Utile / pas clair', 'Commentaires']} empty={contents.length === 0 ? <EmptyState title="Aucune évaluation ni favori pour l’instant" /> : null}>
                    {contents.map((content) => (
                        <tr key={content.key}>
                            <td className="font-medium">{content.href ? <Link href={content.href} className="hover:text-signal">{content.title}</Link> : content.title}</td>
                            <td className="text-muted-foreground">{TYPES[content.type] ?? content.type}</td>
                            <td className="tabular-nums">{content.favorites}</td>
                            <td className="min-w-48">
                                <div className="flex items-center gap-2">
                                    <SplitBar a={content.useful} b={content.unclear} labelA="Utile" labelB="Pas encore clair" colorA="var(--color-chart-1)" colorB="var(--color-chart-3)" className="w-28" />
                                    <span className="tabular-nums text-xs">
                                        {content.useful} / {content.unclear}
                                    </span>
                                </div>
                            </td>
                            <td className="tabular-nums">{content.comments}</td>
                        </tr>
                    ))}
                </Table>
            </Panel>
            {trend.length > 0 && (
                <Panel title="Évolution mensuelle">
                    <Table head={['Mois', 'Utile', 'Pas encore clair']}>
                        {trend.map((row) => (
                            <tr key={row.month}>
                                <td className="font-mono">{row.month}</td>
                                <td className="tabular-nums">{row.useful}</td>
                                <td className="tabular-nums">{row.unclear}</td>
                            </tr>
                        ))}
                    </Table>
                </Panel>
            )}
            <Panel
                padded={false}
                title="Commentaires"
                description="Lus uniquement par l’équipe. « Valider » les marque comme traités, « Masquer » les écarte (contenu inapproprié)."
                actions={<FilterSelect label="Modération" value={moderation} onChange={(value) => applyFilters('/admin/evaluations', { moderation: value })} options={[{ value: 'pending', label: 'À modérer' }, { value: 'approved', label: 'Validés' }, { value: 'hidden', label: 'Masqués' }, { value: 'all', label: 'Tous' }]} />}
            >
                {comments.data.length === 0 ? (
                    <EmptyState title="Aucun commentaire ici" />
                ) : (
                    <ul className="divide-y divide-line/60">
                        {comments.data.map((comment) => (
                            <li key={comment.id} className="flex flex-wrap items-start gap-3 px-5 py-3 text-sm">
                                {comment.value === 'useful' ? <ThumbsUp className="mt-0.5 size-4 text-ok" aria-label="Utile" /> : <ThumbsDown className="mt-0.5 size-4 text-warn" aria-label="Pas encore clair" />}
                                <div className="min-w-0 flex-1">
                                    <p className="whitespace-pre-wrap">{comment.comment}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {comment.subject.title} · {comment.author ?? 'Compte supprimé'} · {formatDateTime(comment.date)}
                                    </p>
                                </div>
                                <StatusPill status={comment.status} />
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => router.put(`/admin/evaluations/${comment.id}/moderation`, { status: 'approved' }, { preserveScroll: true })} className="rounded-lg border border-line p-1.5 hover:bg-ok/10" aria-label="Valider">
                                        <Check className="size-4" aria-hidden />
                                    </button>
                                    <button type="button" onClick={() => router.put(`/admin/evaluations/${comment.id}/moderation`, { status: 'hidden' }, { preserveScroll: true })} className="rounded-lg border border-line p-1.5 hover:bg-danger/10" aria-label="Masquer">
                                        <EyeOff className="size-4" aria-hidden />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <Pagination page={comments} />
            </Panel>
        </AdminPage>
    );
}
