import { Head, Link } from '@inertiajs/react';
import { BadgeCheck, Download, Search, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { AdminPage, applyFilters, EmptyState, FilterSelect, Pagination, Panel, Table } from '@/components/admin/ui';
import type { Paginated } from '@/components/admin/ui';
import { inputClass } from '@/components/forms/fields';
import { countryFlag, formatDate, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export type UserRow = { id: number; name: string; email: string; role: string; verified: boolean; suspended: boolean; country: string | null; country_name: string | null; created_at: string; last_active_at: string | null; labs_completed: number | null; quiz_attempts: number | null };

type Props = {
    users: Paginated<UserRow>;
    filters: { q?: string; role?: string; statut?: string; du?: string; au?: string };
    counts: { total: number; students: number; admins: number; suspended: number; unverified: number };
};

export default function UsersIndex({ users, filters, counts }: Props) {
    const [q, setQ] = useState(filters.q ?? '');
    const apply = (values: Partial<Props['filters']>) => applyFilters('/admin/utilisateurs', { ...filters, ...values });

    return (
        <AdminPage
            title="Utilisateurs"
            description={`${counts.total} comptes · ${counts.students} étudiants · ${counts.admins} administrateurs · ${counts.unverified} non vérifiés · ${counts.suspended} suspendus`}
            actions={
                <a href="/admin/utilisateurs/export" className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-medium hover:bg-night-800">
                    <Download className="size-4" aria-hidden /> Export CSV
                </a>
            }
        >
            <Head title="Utilisateurs" />
            <div className="flex flex-wrap items-center gap-2">
                <form
                    className="relative min-w-60 flex-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        apply({ q });
                    }}
                >
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou adresse e-mail…" aria-label="Rechercher un compte" className={cn(inputClass, 'py-2 pl-9')} />
                </form>
                <FilterSelect label="Rôle" value={filters.role ?? ''} onChange={(role) => apply({ role })} options={[{ value: '', label: 'Tous les rôles' }, { value: 'student', label: 'Étudiants' }, { value: 'admin', label: 'Administrateurs' }]} />
                <FilterSelect label="Statut" value={filters.statut ?? ''} onChange={(statut) => apply({ statut })} options={[{ value: '', label: 'Tous les statuts' }, { value: 'actif', label: 'Actifs' }, { value: 'suspendu', label: 'Suspendus' }, { value: 'non-verifie', label: 'E-mail non vérifié' }]} />
                <label className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    Inscrits du
                    <input type="date" value={filters.du ?? ''} onChange={(e) => apply({ du: e.target.value })} className={cn(inputClass, 'w-auto py-1.5')} />
                    au
                    <input type="date" value={filters.au ?? ''} onChange={(e) => apply({ au: e.target.value })} className={cn(inputClass, 'w-auto py-1.5')} />
                </label>
            </div>
            <Panel padded={false}>
                <Table head={['Compte', 'Rôle', 'E-mail', 'Pays', 'Inscription', 'Dernière activité', 'TP / quiz']} empty={users.data.length === 0 ? <EmptyState icon={Users} title="Aucun compte ne correspond" /> : null}>
                    {users.data.map((user) => (
                        <tr key={user.id} className={cn(user.suspended && 'opacity-60')}>
                            <td>
                                <Link href={`/admin/utilisateurs/${user.id}`} className="font-medium hover:text-signal">
                                    {user.name}
                                </Link>
                                <span className="block text-xs text-muted-foreground">{user.email}</span>
                            </td>
                            <td>{user.role === 'admin' ? <span className="inline-flex items-center gap-1 text-warn"><ShieldCheck className="size-4" aria-hidden /> Admin</span> : 'Étudiant'}{user.suspended && <span className="ml-1 text-xs text-danger">(suspendu)</span>}</td>
                            <td>{user.verified ? <BadgeCheck className="size-4 text-ok" aria-label="Vérifié" /> : <span className="text-xs text-warn">Non vérifié</span>}</td>
                            <td>{user.country ? `${countryFlag(user.country)} ${user.country}` : <span className="text-muted-foreground">—</span>}</td>
                            <td className="whitespace-nowrap">{formatDate(user.created_at)}</td>
                            <td className="whitespace-nowrap text-muted-foreground">{timeAgo(user.last_active_at)}</td>
                            <td className="tabular-nums">
                                {user.labs_completed ?? 0} / {user.quiz_attempts ?? 0}
                            </td>
                        </tr>
                    ))}
                </Table>
                <Pagination page={users} />
            </Panel>
        </AdminPage>
    );
}
