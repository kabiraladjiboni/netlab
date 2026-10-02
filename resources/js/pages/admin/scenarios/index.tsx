import { Head, Link, router } from '@inertiajs/react';
import { Eye, Plus } from 'lucide-react';
import { AdminPage, ButtonLink, Panel, StatusPill, Table } from '@/components/admin/ui';
import { formatDate } from '@/lib/format';

type Row = { id: number; key: string; title: string; description: string | null; source: 'builtin' | 'custom'; status: string; validated_at: string | null; updated_at: string | null; lessons: { slug: string; title: string; sessions: number }[] };

export default function ScenariosIndex({ scenarios }: { scenarios: Row[] }) {
    return (
        <AdminPage
            title="Scénarios animés"
            description="Les scénarios intégrés sont écrits dans le code et testés automatiquement ; tu peux les publier ou les retirer. Les scénarios personnalisés sont des données JSON validées, jouées par le même moteur (aucun code n’est exécuté)."
            actions={<ButtonLink href="/admin/scenarios/nouveau"><Plus className="size-4" aria-hidden /> Nouveau scénario</ButtonLink>}
        >
            <Head title="Scénarios" />
            <Panel padded={false}>
                <Table head={['Scénario', 'Source', 'Utilisé par', 'Validé', 'Statut', '']}>
                    {scenarios.map((s) => (
                        <tr key={s.id}>
                            <td>
                                <Link href={`/admin/scenarios/${s.id}`} className="font-medium hover:text-signal">
                                    {s.title}
                                </Link>
                                <span className="block font-mono text-xs text-muted-foreground">{s.key}</span>
                            </td>
                            <td>
                                <StatusPill status={s.source} />
                            </td>
                            <td className="text-sm">
                                {s.lessons.length === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                ) : (
                                    s.lessons.map((lesson) => (
                                        <span key={lesson.slug} className="block">
                                            {lesson.title} <span className="text-xs text-muted-foreground">({lesson.sessions} séances)</span>
                                        </span>
                                    ))
                                )}
                            </td>
                            <td className="whitespace-nowrap text-muted-foreground">{s.validated_at ? formatDate(s.validated_at) : <span className="text-warn">Non valide</span>}</td>
                            <td>
                                <StatusPill status={s.status} />
                            </td>
                            <td className="text-right">
                                <button
                                    type="button"
                                    onClick={() => router.post(`/admin/scenarios/${s.id}/publication`, { status: s.status === 'published' ? 'draft' : 'published' }, { preserveScroll: true })}
                                    className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-night-800"
                                >
                                    {s.status === 'published' ? 'Retirer' : 'Publier'}
                                </button>
                                {s.lessons[0] && (
                                    <a href={`/lecons/${s.lessons[0].slug}`} target="_blank" rel="noreferrer" className="ml-1 inline-flex rounded-lg p-1.5 text-muted-foreground hover:bg-night-800" aria-label="Voir">
                                        <Eye className="size-4" aria-hidden />
                                    </a>
                                )}
                            </td>
                        </tr>
                    ))}
                </Table>
            </Panel>
        </AdminPage>
    );
}
