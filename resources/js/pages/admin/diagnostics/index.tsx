import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { AdminPage, ButtonLink, Panel, StatusPill, Table } from '@/components/admin/ui';

type Row = { id: number; slug: string; title: string; difficulty: string; status: string; sessions: number; solved: number };

export default function DiagnosticsIndex({ diagnostics }: { diagnostics: Row[] }) {
    return (
        <AdminPage title="Exercices de diagnostic" actions={<ButtonLink href="/admin/diagnostics/nouveau"><Plus className="size-4" aria-hidden /> Nouvel exercice</ButtonLink>}>
            <Head title="Diagnostics" />
            <Panel padded={false}>
                <Table head={['Exercice', 'Difficulté', 'Tentatives', 'Résolus', 'Statut']}>
                    {diagnostics.map((d) => (
                        <tr key={d.id}>
                            <td>
                                <Link href={`/admin/diagnostics/${d.id}`} className="font-medium hover:text-signal">
                                    {d.title}
                                </Link>
                            </td>
                            <td>{d.difficulty}</td>
                            <td className="tabular-nums">{d.sessions}</td>
                            <td className="tabular-nums">
                                {d.solved} {d.sessions > 0 && <span className="text-xs text-muted-foreground">({Math.round((d.solved / d.sessions) * 100)} %)</span>}
                            </td>
                            <td>
                                <StatusPill status={d.status} />
                            </td>
                        </tr>
                    ))}
                </Table>
            </Panel>
        </AdminPage>
    );
}
