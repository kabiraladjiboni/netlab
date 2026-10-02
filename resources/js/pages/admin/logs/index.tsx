import { Head } from '@inertiajs/react';
import { FileClock } from 'lucide-react';
import { AdminPage, applyFilters, EmptyState, FilterSelect, Pagination, Panel, Table } from '@/components/admin/ui';
import type { Paginated } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/format';

type Log = { id: number; action: string; subject_type: string | null; label: string | null; details: Record<string, unknown> | null; actor: string; date: string };

export default function Logs({ logs, actions, filter }: { logs: Paginated<Log>; actions: string[]; filter: string }) {
    return (
        <AdminPage title="Journal d’administration" description="Opérations sensibles : acteur, action, date et informations strictement nécessaires. Jamais de mot de passe, de jeton ni de clé.">
            <Head title="Journal" />
            <FilterSelect label="Filtrer" value={filter} onChange={(action) => applyFilters('/admin/journal', { action })} options={[{ value: '', label: 'Toutes les actions' }, ...actions.map((a) => ({ value: a, label: a }))]} />
            <Panel padded={false}>
                <Table head={['Date', 'Acteur', 'Action', 'Objet', 'Détails']} empty={logs.data.length === 0 ? <EmptyState icon={FileClock} title="Aucune opération journalisée" /> : null}>
                    {logs.data.map((log) => (
                        <tr key={log.id}>
                            <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(log.date)}</td>
                            <td>{log.actor}</td>
                            <td>
                                <code className="rounded bg-night-800 px-1.5 py-0.5 font-mono text-xs">{log.action}</code>
                            </td>
                            <td>{log.label}</td>
                            <td className="max-w-xs font-mono text-xs break-all text-muted-foreground">{log.details ? JSON.stringify(log.details) : '—'}</td>
                        </tr>
                    ))}
                </Table>
                <Pagination page={logs} />
            </Panel>
        </AdminPage>
    );
}
