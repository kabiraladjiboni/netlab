import { Head, Link, useForm } from '@inertiajs/react';
import { MessageSquareWarning } from 'lucide-react';
import { useState } from 'react';
import { AdminPage, applyFilters, EmptyState, FilterSelect, Pagination, Panel, StatusPill } from '@/components/admin/ui';
import type { Paginated } from '@/components/admin/ui';
import { inputClass } from '@/components/forms/fields';
import { formatDateTime } from '@/lib/format';

type Report = { id: number; category: string; message: string; status: string; priority: string; admin_note: string | null; page_url: string | null; subject: { title: string; href: string | null } | null; author: string; author_id: number | null; handler: string | null; created_at: string; resolved_at: string | null };
type Props = { reports: Paginated<Report>; filters: { statut?: string; categorie?: string; priorite?: string }; categories: Record<string, string>; statuses: Record<string, string>; priorities: Record<string, string>; counts: Record<string, number> };

export default function FeedbackIndex({ reports, filters, categories, statuses, priorities, counts }: Props) {
    const apply = (values: Record<string, string>) => applyFilters('/admin/retours', { ...filters, ...values });
    return (
        <AdminPage title="Retours des étudiants" description={`${counts.new ?? 0} nouveau(x) · ${counts.in_progress ?? 0} en cours · ${counts.resolved ?? 0} résolu(s) · ${counts.closed ?? 0} fermé(s). Les retours ne sont jamais publiés.`}>
            <Head title="Retours" />
            <div className="flex flex-wrap gap-2">
                <FilterSelect label="Statut" value={filters.statut ?? ''} onChange={(statut) => apply({ statut })} options={[{ value: '', label: 'Tous les statuts' }, ...Object.entries(statuses).map(([value, label]) => ({ value, label }))]} />
                <FilterSelect label="Type" value={filters.categorie ?? ''} onChange={(categorie) => apply({ categorie })} options={[{ value: '', label: 'Tous les types' }, ...Object.entries(categories).map(([value, label]) => ({ value, label }))]} />
                <FilterSelect label="Priorité" value={filters.priorite ?? ''} onChange={(priorite) => apply({ priorite })} options={[{ value: '', label: 'Toutes priorités' }, ...Object.entries(priorities).map(([value, label]) => ({ value, label }))]} />
            </div>
            {reports.data.length === 0 ? (
                <Panel>
                    <EmptyState icon={MessageSquareWarning} title="Aucun retour pour ces filtres" />
                </Panel>
            ) : (
                <div className="space-y-3">
                    {reports.data.map((report) => (
                        <ReportCard key={report.id} report={report} categories={categories} statuses={statuses} priorities={priorities} />
                    ))}
                </div>
            )}
            <Panel padded={false}>
                <Pagination page={reports} />
            </Panel>
        </AdminPage>
    );
}

function ReportCard({ report, categories, statuses, priorities }: { report: Report; categories: Record<string, string>; statuses: Record<string, string>; priorities: Record<string, string> }) {
    const [open, setOpen] = useState(report.status === 'new');
    const form = useForm({ status: report.status, priority: report.priority, admin_note: report.admin_note ?? '' });
    return (
        <article className="rounded-2xl border border-line bg-card">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left">
                <StatusPill status={report.status} />
                <StatusPill status={report.priority} />
                <span className="font-medium">{categories[report.category] ?? report.category}</span>
                {report.subject && <span className="text-sm text-muted-foreground">· {report.subject.title}</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                    {report.author} · {formatDateTime(report.created_at)}
                </span>
            </button>
            {open && (
                <div className="grid grid-cols-1 gap-4 border-t border-line px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="space-y-2 text-sm">
                        <p className="leading-relaxed whitespace-pre-wrap">{report.message}</p>
                        <p className="text-xs text-muted-foreground">
                            {report.page_url && (
                                <>
                                    Page :{' '}
                                    <a href={report.page_url} target="_blank" rel="noreferrer" className="font-mono text-signal hover:underline">
                                        {report.page_url}
                                    </a>
                                </>
                            )}
                            {report.subject?.href && (
                                <>
                                    {' · '}
                                    <Link href={report.subject.href} className="text-signal hover:underline">
                                        Ouvrir le contenu
                                    </Link>
                                </>
                            )}
                            {report.author_id && (
                                <>
                                    {' · '}
                                    <Link href={`/admin/utilisateurs/${report.author_id}`} className="text-signal hover:underline">
                                        Voir le compte
                                    </Link>
                                </>
                            )}
                        </p>
                        {report.handler && <p className="text-xs text-muted-foreground">Traité par {report.handler}{report.resolved_at ? ` · résolu le ${formatDateTime(report.resolved_at)}` : ''}</p>}
                    </div>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.put(`/admin/retours/${report.id}`, { preserveScroll: true });
                        }}
                        className="space-y-2"
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} className={inputClass} aria-label="Statut">
                                {Object.entries(statuses).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <select value={form.data.priority} onChange={(e) => form.setData('priority', e.target.value)} className={inputClass} aria-label="Priorité">
                                {Object.entries(priorities).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        Priorité {label.toLowerCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <textarea value={form.data.admin_note} onChange={(e) => form.setData('admin_note', e.target.value)} rows={3} placeholder="Note interne (non visible par l’étudiant)" className={inputClass} aria-label="Note interne" />
                        <button type="submit" disabled={form.processing || !form.isDirty} className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">
                            Enregistrer
                        </button>
                    </form>
                </div>
            )}
        </article>
    );
}
