import { Link } from '@inertiajs/react';
import { ArrowRight, CircleCheck, Stethoscope } from 'lucide-react';
import { PageHeader } from '@/components/content/page-header';
import { useProgress } from '@/hooks/use-progress';
import { cn } from '@/lib/utils';

type Item = { slug: string; title: string; difficulty: 'facile' | 'moyen' | 'difficile'; summary: string };

export const difficultyStyle: Record<Item['difficulty'], string> = {
    facile: 'border-ok/40 text-ok',
    moyen: 'border-warn/40 text-warn',
    difficile: 'border-danger/40 text-danger',
};

export default function DiagnosticsIndex({ diagnostics }: { diagnostics: Item[] }) {
    const progress = useProgress();
    return (
        <>
            <PageHeader
                eyebrow="Parcours de diagnostic"
                title="Diagnostiquer une panne réseau"
                description="Observe les symptômes, examine les commandes et les captures, demande des indices si besoin, puis choisis la cause la plus plausible. Ce sont des scénarios pédagogiques, pas des émulations d’équipements."
            />
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {diagnostics.map((item) => {
                        const state = progress.diagnostics[item.slug];
                        return (
                            <li key={item.slug}>
                                <Link href={`/diagnostic/${item.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-signal/50">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex size-9 items-center justify-center rounded-xl bg-warn/12 text-warn">
                                            <Stethoscope className="size-4" aria-hidden />
                                        </span>
                                        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', difficultyStyle[item.difficulty])}>{item.difficulty}</span>
                                    </div>
                                    <h2 className="mt-3 font-display text-lg leading-snug font-semibold group-hover:text-signal">{item.title}</h2>
                                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{item.summary}</p>
                                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-signal">
                                        {state?.solved ? (
                                            <>
                                                <CircleCheck className="size-4 text-ok" aria-hidden /> <span className="text-ok">Résolu</span>
                                            </>
                                        ) : (
                                            <>
                                                Enquêter <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                                            </>
                                        )}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </>
    );
}
