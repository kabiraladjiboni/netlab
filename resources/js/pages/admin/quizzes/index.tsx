import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { AdminPage, ButtonLink, Panel, StatusPill, Table } from '@/components/admin/ui';

type Row = { id: number; slug: string; title: string; module: string | null; questions: number; status: string; attempts: number; average: number | null };

export default function QuizzesIndex({ quizzes }: { quizzes: Row[] }) {
    return (
        <AdminPage title="Quiz" description="Questions de validation avec correction détaillée. Les quiz des fiches protocoles sans quiz dédié sont générés automatiquement à partir des données validées." actions={<ButtonLink href="/admin/quiz/nouveau"><Plus className="size-4" aria-hidden /> Nouveau quiz</ButtonLink>}>
            <Head title="Quiz" />
            <Panel padded={false}>
                <Table head={['Quiz', 'Module', 'Questions', 'Tentatives', 'Moyenne', 'Statut']}>
                    {quizzes.map((quiz) => (
                        <tr key={quiz.id}>
                            <td>
                                <Link href={`/admin/quiz/${quiz.id}`} className="font-medium hover:text-signal">
                                    {quiz.title}
                                </Link>
                                <span className="block font-mono text-xs text-muted-foreground">{quiz.slug}</span>
                            </td>
                            <td className="text-muted-foreground">{quiz.module ?? '—'}</td>
                            <td className="tabular-nums">{quiz.questions}</td>
                            <td className="tabular-nums">{quiz.attempts}</td>
                            <td className="tabular-nums">{quiz.average === null ? '—' : `${quiz.average} %`}</td>
                            <td>
                                <StatusPill status={quiz.status} />
                            </td>
                        </tr>
                    ))}
                </Table>
            </Panel>
        </AdminPage>
    );
}
