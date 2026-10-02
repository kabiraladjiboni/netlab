import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { LessonCard } from '@/components/content/lesson-card';
import type { LabStatus, LessonSummary } from '@/types/content';

type Course = { slug: string; title: string; description: string | null; level: string; lessons: (LessonSummary & { concepts: string[]; status: LabStatus })[] };

export default function CourseShow({ course }: { course: Course }) {
    const done = course.lessons.filter((lesson) => lesson.status?.completed).length;
    const totalMinutes = course.lessons.reduce((sum, lesson) => sum + lesson.duration, 0);
    return (
        <>
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
                <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Link href="/apprendre" className="hover:text-foreground">
                        Cours
                    </Link>
                    <ChevronRight className="size-3.5" aria-hidden />
                    <span>{course.title}</span>
                </nav>
                <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{course.title}</h1>
                {course.description && <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{course.description}</p>}
                <p className="mt-3 text-sm text-muted-foreground">
                    {course.lessons.length} chapitres · environ {totalMinutes} min · {done} terminé(s)
                </p>
                <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {course.lessons.map((lesson, index) => (
                        <li key={lesson.slug}>
                            <LessonCard lesson={lesson} status={lesson.status} index={index} />
                        </li>
                    ))}
                </ol>
            </div>
        </>
    );
}
