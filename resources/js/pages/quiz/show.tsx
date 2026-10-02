import { Link } from '@inertiajs/react';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/content/page-header';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { LessonSummary, Quiz } from '@/types/content';

export default function QuizShow({ quiz, lesson }: { quiz: Quiz; lesson: LessonSummary | null }) {
    return (
        <>
            <PageHeader
                eyebrow={
                    <Link href="/quiz" className="inline-flex items-center gap-1 hover:underline">
                        <ArrowLeft className="size-3.5" aria-hidden /> Tous les quiz
                    </Link>
                }
                title={quiz.title}
                description={quiz.description ?? undefined}
                actions={
                    lesson && (
                        <Link href={lesson.href} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm hover:border-signal/60">
                            <PlayCircle className="size-4 text-signal" aria-hidden /> Revoir la leçon
                        </Link>
                    )
                }
            />
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
                <QuizRunner quiz={quiz} />
            </div>
        </>
    );
}
