import { Head, Link } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { AdminPage, applyFilters, ButtonLink, Pagination, Panel, StatusPill, Table } from '@/components/admin/ui';
import type { Paginated } from '@/components/admin/ui';
import { inputClass } from '@/components/forms/fields';
import { cn } from '@/lib/utils';

type Row = { id: number; slug: string; term: string; category: string | null; simple: string; protocols: number; status: string };

export default function TermsIndex({ terms, filters }: { terms: Paginated<Row>; filters: { q: string } }) {
    const [q, setQ] = useState(filters.q ?? '');
    return (
        <AdminPage title="Glossaire" description="Termes du dictionnaire, affichés en infobulle partout où ils sont cités." actions={<ButtonLink href="/admin/glossaire/nouveau"><Plus className="size-4" aria-hidden /> Nouveau terme</ButtonLink>}>
            <Head title="Glossaire" />
            <form
                className="relative max-w-md"
                onSubmit={(event) => {
                    event.preventDefault();
                    applyFilters('/admin/glossaire', { q });
                }}
            >
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un terme…" aria-label="Rechercher un terme" className={cn(inputClass, 'py-2 pl-9')} />
            </form>
            <Panel padded={false}>
                <Table head={['Terme', 'Catégorie', 'Définition simple', 'Fiches', 'Statut']}>
                    {terms.data.map((term) => (
                        <tr key={term.id}>
                            <td>
                                <Link href={`/admin/glossaire/${term.id}`} className="font-medium hover:text-signal">
                                    {term.term}
                                </Link>
                            </td>
                            <td className="text-muted-foreground">{term.category ?? '—'}</td>
                            <td className="max-w-md text-muted-foreground">{term.simple}</td>
                            <td className="tabular-nums">{term.protocols}</td>
                            <td>
                                <StatusPill status={term.status} />
                            </td>
                        </tr>
                    ))}
                </Table>
                <Pagination page={terms} />
            </Panel>
        </AdminPage>
    );
}
