import { Link } from '@inertiajs/react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { PageHeader } from '@/components/content/page-header';
import { useProgress } from '@/hooks/use-progress';

type QuizItem = { slug: string; title: string; module: string | null; count: number };

const modules: Record<string, string> = { lecons: 'Leçons', modeles: 'Modèles et architecture', wireshark: 'Analyse du trafic' };

export default function QuizIndex({ quizzes }: { quizzes: QuizItem[] }) {
    const progress = useProgress();
    const groups = quizzes.reduce<Record<string, QuizItem[]>>((acc, quiz) => {
        (acc[quiz.module ?? 'autres'] ??= []).push(quiz);
        return acc;
    }, {});
    return (
        <>
            <PageHeader
                eyebrow="S’entraîner"
                title="Tester ses connaissances"
                description="Choix multiples, associations, remises en ordre : chaque correction explique pourquoi. Chaque fiche protocole possède aussi son propre quiz."
            />
            {Object.entries(groups).map(([module, items]) => (
                <section key={module} className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
                    <h2 className="font-display text-xl font-semibold">{modules[module] ?? 'Autres'}</h2>
                    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((quiz) => {
                            const result = progress.quizzes[quiz.slug];
                            return (
                                <li key={quiz.slug}>
                                    <Link href={`/quiz/${quiz.slug}`} className="group flex h-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-signal/50">
                                        <span>
                                            <span className="block font-medium">{quiz.title.replace('Quiz — ', '')}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {quiz.count} questions
                                                {result && (
                                                    <span className="ml-2 inline-flex items-center gap-1 text-ok">
                                                        <CircleCheck className="size-3" aria-hidden /> {result.score}/{result.total}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                        <ArrowRight className="size-4 text-signal transition group-hover:translate-x-1" aria-hidden />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </>
    );
}
