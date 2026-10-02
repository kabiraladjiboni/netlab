import { Head, Link } from '@inertiajs/react';
import { BookOpen, ClipboardCheck, FlaskConical, History as HistoryIcon, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/admin/ui';
import { StudentShell } from '@/components/learning/student-shell';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type Item = { kind: 'lab' | 'quiz' | 'lesson' | 'diagnostic'; slug: string; title: string; href: string | null; status: string; progress: number | null; visits?: number; date: string };

const KINDS = { lab: { label: 'TP', icon: FlaskConical }, quiz: { label: 'Quiz', icon: ClipboardCheck }, lesson: { label: 'Leçon', icon: BookOpen }, diagnostic: { label: 'Diagnostic', icon: Stethoscope } };

export default function History({ items }: { items: Item[] }) {
    const [filter, setFilter] = useState<'all' | Item['kind']>('all');
    const shown = filter === 'all' ? items : items.filter((item) => item.kind === filter);
    return (
        <StudentShell title="Mon historique" description="Toutes tes activités, de la plus récente à la plus ancienne.">
            <Head title="Mon historique" />
            <div role="radiogroup" aria-label="Filtrer" className="mb-4 flex flex-wrap gap-2">
                {(['all', 'lab', 'quiz', 'lesson', 'diagnostic'] as const).map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        role="radio"
                        aria-checked={filter === kind}
                        onClick={() => setFilter(kind)}
                        className={cn('rounded-full border px-3 py-1.5 text-sm', filter === kind ? 'border-signal bg-signal/15' : 'border-line text-muted-foreground hover:text-foreground')}
                    >
                        {kind === 'all' ? 'Tout' : KINDS[kind].label}
                    </button>
                ))}
            </div>
            <div className="rounded-3xl border border-line bg-surface">
                {shown.length === 0 ? (
                    <EmptyState icon={HistoryIcon} title="Rien pour l’instant">
                        Tes activités apparaîtront ici dès que tu consulteras une leçon ou lanceras un TP.
                    </EmptyState>
                ) : (
                    <ol className="divide-y divide-line/60">
                        {shown.map((item, index) => {
                            const Icon = KINDS[item.kind].icon;
                            return (
                                <li key={`${item.kind}-${item.slug}-${index}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                    <span className="w-20 shrink-0 text-xs text-muted-foreground">{KINDS[item.kind].label}</span>
                                    <span className="min-w-0 flex-1">{item.href ? <Link href={item.href} className="font-medium hover:text-signal">{item.title}</Link> : item.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {item.kind === 'lesson' ? `${item.visits ?? 1} visite(s)` : item.kind === 'quiz' ? `${item.progress} %` : item.status === 'completed' ? 'Terminé' : `${item.progress ?? 0} %`}
                                    </span>
                                    <span className="w-36 text-right text-xs text-muted-foreground">{formatDateTime(item.date)}</span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </StudentShell>
    );
}
