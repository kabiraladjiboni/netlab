import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, Circle, CircleDot, GraduationCap, Stethoscope } from 'lucide-react';
import { StudentShell } from '@/components/learning/student-shell';
import { cn } from '@/lib/utils';
import type { LessonSummary } from '@/types/content';

type Lesson = LessonSummary & { visited: boolean; lab: { completed: boolean; progress: number; started: boolean } | null; quiz: { slug: string; best: number | null } | null };
type Course = { slug: string; title: string; description: string | null; lessons: Lesson[]; done: number; total: number };
type Diagnostic = { slug: string; title: string; difficulty: string; status: string | null; attempts: number | null; hints: number | null };

export default function Progress({ courses, diagnostics }: { courses: Course[]; diagnostics: Diagnostic[] }) {
    return (
        <StudentShell title="Ma progression" description="Chaque chapitre, son TP et ton meilleur score au quiz.">
            <Head title="Ma progression" />
            <div className="space-y-6">
                {courses.map((course) => (
                    <section key={course.slug} className="rounded-3xl border border-line bg-surface">
                        <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
                            <div className="min-w-0 flex-1">
                                <h2 className="font-display text-lg font-semibold">
                                    <Link href={`/cours/${course.slug}`} className="hover:text-signal">
                                        {course.title}
                                    </Link>
                                </h2>
                            </div>
                            <div className="flex w-48 items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-night-700">
                                    <div className="h-full rounded-full bg-gradient-to-r from-signal to-ok" style={{ width: `${(course.done / Math.max(1, course.total)) * 100}%` }} />
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">
                                    {course.done}/{course.total}
                                </span>
                            </div>
                        </div>
                        <ol className="divide-y divide-line/60">
                            {course.lessons.map((lesson, index) => {
                                const done = lesson.lab ? lesson.lab.completed : lesson.visited;
                                const started = lesson.lab ? lesson.lab.started : lesson.visited;
                                return (
                                    <li key={lesson.slug} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                        {done ? <CheckCircle2 className="size-5 shrink-0 text-ok" aria-label="Terminé" /> : started ? <CircleDot className="size-5 shrink-0 text-signal" aria-label="En cours" /> : <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="Pas commencé" />}
                                        <span className="w-6 font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                                        <Link href={lesson.lab && lesson.lab.started ? `/laboratoire/${lesson.slug}` : lesson.href} className="min-w-0 flex-1 font-medium hover:text-signal">
                                            {lesson.title}
                                        </Link>
                                        {lesson.lab && (
                                            <span className={cn('w-24 text-right text-xs', lesson.lab.completed ? 'text-ok' : 'text-muted-foreground')}>TP {lesson.lab.progress} %</span>
                                        )}
                                        {lesson.quiz && (
                                            <Link href={`/quiz/${lesson.quiz.slug}`} className="inline-flex w-28 items-center justify-end gap-1 text-xs text-muted-foreground hover:text-signal">
                                                <GraduationCap className="size-3.5" aria-hidden /> {lesson.quiz.best === null || lesson.quiz.best === undefined ? 'Quiz à faire' : `Quiz ${lesson.quiz.best} %`}
                                            </Link>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))}

                <section className="rounded-3xl border border-line bg-surface">
                    <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-lg font-semibold">
                        <Stethoscope className="size-5 text-danger" aria-hidden /> Exercices de diagnostic
                    </h2>
                    <ul className="divide-y divide-line/60">
                        {diagnostics.map((diagnostic) => (
                            <li key={diagnostic.slug} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                {diagnostic.status === 'completed' ? <CheckCircle2 className="size-5 shrink-0 text-ok" aria-label="Résolu" /> : diagnostic.status ? <CircleDot className="size-5 shrink-0 text-signal" aria-label="En cours" /> : <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="Pas commencé" />}
                                <Link href={`/diagnostic/${diagnostic.slug}`} className="min-w-0 flex-1 font-medium hover:text-signal">
                                    {diagnostic.title}
                                </Link>
                                {diagnostic.status && (
                                    <span className="text-xs text-muted-foreground">
                                        {diagnostic.attempts} essai(s) · {diagnostic.hints} indice(s)
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </StudentShell>
    );
}
