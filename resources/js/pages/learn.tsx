import { Link } from '@inertiajs/react';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { LessonCard } from '@/components/content/lesson-card';
import { PageHeader } from '@/components/content/page-header';
import { useAuth } from '@/hooks/use-auth';
import type { LabStatus, LessonSummary } from '@/types/content';

type Course = { slug: string; title: string; description: string | null; level: string; lessons: (LessonSummary & { quiz: string | null; status: LabStatus })[] };

const LEVELS: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };

export default function Learn({ courses }: { courses: Course[] }) {
    const user = useAuth();
    const all = courses.flatMap((course) => course.lessons);
    const done = all.filter((lesson) => lesson.status?.completed).length;

    return (
        <>
            <PageHeader
                eyebrow="Cours gratuits"
                title="Choisis ton cours"
                description="Chaque chapitre commence par une explication et un aperçu animé. Les TP interactifs complets se jouent dans le laboratoire, avec un compte gratuit."
            />
            {user && (
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                    <div className="glass flex flex-wrap items-center gap-6 rounded-3xl p-5">
                        <div>
                            <p className="text-xs text-muted-foreground">Chapitres terminés</p>
                            <p className="font-display text-2xl font-semibold">
                                {done} <span className="text-base text-muted-foreground">/ {all.length}</span>
                            </p>
                        </div>
                        <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-night-700" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={all.length} aria-label="Progression globale">
                            <div className="h-full rounded-full bg-gradient-to-r from-signal to-ok" style={{ width: `${(done / Math.max(1, all.length)) * 100}%` }} />
                        </div>
                        <Link href="/app/ma-progression" className="inline-flex items-center gap-1 text-sm font-medium text-signal hover:underline">
                            Ma progression détaillée <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    </div>
                </div>
            )}
            {courses.map((course, courseIndex) => (
                <section key={course.slug} className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-labelledby={`course-${course.slug}`}>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold tracking-[0.16em] text-signal uppercase">
                                Cours {courseIndex + 1} · {LEVELS[course.level] ?? course.level} · {course.lessons.length} chapitres
                            </p>
                            <h2 id={`course-${course.slug}`} className="mt-1 font-display text-2xl font-semibold">
                                {course.title}
                            </h2>
                            {course.description && <p className="mt-1 text-muted-foreground">{course.description}</p>}
                        </div>
                        <Link href={`/cours/${course.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-signal hover:underline">
                            Voir le cours <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    </div>
                    <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {course.lessons.map((lesson, index) => (
                            <li key={lesson.slug} className="flex flex-col gap-2">
                                <LessonCard lesson={lesson} status={lesson.status} index={index} className="flex-1" />
                                {lesson.quiz && (
                                    <Link href={`/quiz/${lesson.quiz}`} className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-signal">
                                        <GraduationCap className="size-3.5" aria-hidden /> Quiz du chapitre
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );
}
