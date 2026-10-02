import { Head, Link } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { AdminPage, applyFilters, ButtonLink, FilterSelect, Pagination, Panel, StatusPill, Table } from '@/components/admin/ui';
import type { Paginated } from '@/components/admin/ui';
import { inputClass } from '@/components/forms/fields';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Row = { id: number; slug: string; acronym: string; name: string; category: string | null; completeness: string; status: string; updated_at: string | null };

export default function ProtocolsIndex({ protocols, filters, categories }: { protocols: Paginated<Row>; filters: { q?: string; categorie?: string; statut?: string }; categories: { slug: string; name: string }[] }) {
    const [q, setQ] = useState(filters.q ?? '');
    const apply = (values: Record<string, string>) => applyFilters('/admin/protocoles', { ...filters, ...values });
    return (
        <AdminPage
            title="Protocoles"
            description="Fiches du catalogue. Une fiche « complète » doit contenir échanges, champs, erreurs, limites et termes ; chaque fiche cite au moins une référence."
            actions={
                <ButtonLink href="/admin/protocoles/nouveau">
                    <Plus className="size-4" aria-hidden /> Nouvelle fiche
                </ButtonLink>
            }
        >
            <Head title="Protocoles" />
            <div className="flex flex-wrap gap-2">
                <form
                    className="relative min-w-60 flex-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        apply({ q });
                    }}
                >
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sigle, nom, port…" aria-label="Rechercher une fiche" className={cn(inputClass, 'py-2 pl-9')} />
                </form>
                <FilterSelect label="Famille" value={filters.categorie ?? ''} onChange={(categorie) => apply({ categorie })} options={[{ value: '', label: 'Toutes les familles' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]} />
                <FilterSelect label="Statut" value={filters.statut ?? ''} onChange={(statut) => apply({ statut })} options={[{ value: '', label: 'Publiés et brouillons' }, { value: 'published', label: 'Publiés' }, { value: 'draft', label: 'Brouillons' }]} />
            </div>
            <Panel padded={false}>
                <Table head={['Fiche', 'Famille', 'Niveau de détail', 'Statut', 'Modifiée']}>
                    {protocols.data.map((p) => (
                        <tr key={p.id}>
                            <td>
                                <Link href={`/admin/protocoles/${p.id}`} className="font-medium hover:text-signal">
                                    <span className="font-mono">{p.acronym}</span> — {p.name}
                                </Link>
                            </td>
                            <td className="text-muted-foreground">{p.category}</td>
                            <td>{p.completeness === 'complete' ? 'Complète' : 'Essentielle'}</td>
                            <td>
                                <StatusPill status={p.status} />
                            </td>
                            <td className="whitespace-nowrap text-muted-foreground">{formatDate(p.updated_at)}</td>
                        </tr>
                    ))}
                </Table>
                <Pagination page={protocols} />
            </Panel>
        </AdminPage>
    );
}
