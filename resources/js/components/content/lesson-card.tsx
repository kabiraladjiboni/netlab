import { Link } from '@inertiajs/react';
import { ArrowRight, CircleCheck, Clock, FlaskConical, MonitorPlay } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabStatus, LessonSummary } from '@/types/content';

/** Carte de chapitre : l'état vient du serveur (progression du compte), jamais deviné. */
export function LessonCard({ lesson, status, className, index }: { lesson: LessonSummary; status?: (LabStatus & { visited?: boolean }) | null; className?: string; index?: number }) {
    const done = status?.completed ?? false;
    const percent = status?.progress ?? 0;
    const lab = lesson.kind === 'scenario';

    return (
        <Link
            href={lesson.href}
            className={cn(
                'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-signal/50 hover:shadow-xl hover:shadow-electric/10',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    {index !== undefined && <span className="font-mono">{String(index + 1).padStart(2, '0')} ·</span>}
                    {lab ? <FlaskConical className="size-3.5 text-signal" aria-hidden /> : <MonitorPlay className="size-3.5" aria-hidden />}
                    {lab ? 'Animation + TP' : 'Page interactive'}
                </span>
                {done ? (
                    <span className="inline-flex items-center gap-1 font-medium text-ok">
                        <CircleCheck className="size-3.5" aria-hidden /> Terminé
                    </span>
                ) : percent > 0 ? (
                    <span className="font-medium text-signal">{percent} %</span>
                ) : (
                    <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden /> {lesson.duration} min
                    </span>
                )}
            </div>
            <h3 className="mt-3 font-display text-lg leading-snug font-semibold group-hover:text-signal">{lesson.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{lesson.objective}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-signal">
                {percent > 0 && !done ? 'Reprendre' : done ? 'Revoir' : 'Découvrir'} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
            {percent > 0 && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-night-700" aria-hidden>
                    <span className={cn('block h-full', done ? 'bg-ok' : 'bg-signal')} style={{ width: `${done ? 100 : percent}%` }} />
                </span>
            )}
        </Link>
    );
}
