import { Link } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, Clock, FlaskConical, Lock, Stethoscope } from 'lucide-react';
import { PageHeader, Section } from '@/components/content/page-header';
import { LabGate } from '@/components/learning/lab-gate';
import type { AccessStatus } from '@/components/learning/lab-gate';
import { cn } from '@/lib/utils';
import type { LabStatus, LessonSummary } from '@/types/content';
import { difficultyStyle } from '../diagnostics/index';

type Lab = LessonSummary & { concepts: string[]; status: LabStatus };
type Diagnostic = { slug: string; title: string; difficulty: string; summary: string; status: LabStatus };

export default function LabIndex({ labs, diagnostics, access }: { labs: Lab[]; diagnostics: Diagnostic[]; access: AccessStatus }) {
    const done = labs.filter((lab) => lab.status?.completed).length;
    return (
        <>
            <PageHeader
                eyebrow="Travaux pratiques"
                title="Le laboratoire"
                description="Manipule les échanges réseau paquet par paquet, change de situation, puis mets-toi dans la peau d’un technicien face à une panne. Les TP sont gratuits ; un compte permet de les lancer et de sauvegarder ta progression."
                actions={
                    access === 'allowed' ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm">
                            <CheckCircle2 className="size-4 text-ok" aria-hidden /> {done} / {labs.length} TP terminés
                        </span>
                    ) : undefined
                }
            />
            {access !== 'allowed' && (
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                    <LabGate access={access} labHref="/laboratoire" />
                </div>
            )}

            <Section title={<span className="flex items-center gap-2"><FlaskConical className="size-6 text-signal" aria-hidden /> TP animés</span>} description="Chaque TP suit un échange complet. Commence par le premier si tu débutes.">
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {labs.map((lab, index) => (
                        <li key={lab.slug}>
                            <Link
                                href={access === 'allowed' ? `/laboratoire/${lab.slug}` : lab.href}
                                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-signal/50"
                            >
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="font-mono">TP {String(index + 1).padStart(2, '0')}</span>
                                    {lab.status?.completed ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-ok">
                                            <CheckCircle2 className="size-3.5" aria-hidden /> Terminé
                                        </span>
                                    ) : lab.status ? (
                                        <span className="font-medium text-signal">{lab.status.progress} %</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            <Clock className="size-3.5" aria-hidden /> {lab.duration} min
                                        </span>
                                    )}
                                </div>
                                <h3 className="mt-3 font-display text-lg leading-snug font-semibold group-hover:text-signal">{lab.title}</h3>
                                <p className="mt-2 flex-1 text-sm text-muted-foreground">{lab.objective}</p>
                                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-signal">
                                    {access !== 'allowed' ? (
                                        <>
                                            <Lock className="size-4" aria-hidden /> Voir l’aperçu
                                        </>
                                    ) : lab.status && !lab.status.completed ? (
                                        'Reprendre'
                                    ) : lab.status?.completed ? (
                                        'Refaire'
                                    ) : (
                                        'Commencer'
                                    )}
                                    <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                                </span>
                                {lab.status && (
                                    <span className="absolute inset-x-0 bottom-0 h-1 bg-night-700" aria-hidden>
                                        <span className={cn('block h-full', lab.status.completed ? 'bg-ok' : 'bg-signal')} style={{ width: `${lab.status.progress}%` }} />
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title={<span className="flex items-center gap-2"><Stethoscope className="size-6 text-danger" aria-hidden /> Exercices de diagnostic</span>} description="Une panne, des observations, des indices progressifs : trouve la cause.">
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {diagnostics.map((diagnostic) => (
                        <li key={diagnostic.slug}>
                            <Link href={`/diagnostic/${diagnostic.slug}`} className="group flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-signal/50">
                                <span className={cn('mt-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', difficultyStyle[diagnostic.difficulty as keyof typeof difficultyStyle])}>{diagnostic.difficulty}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium group-hover:text-signal">{diagnostic.title}</span>
                                    <span className="mt-1 block text-sm text-muted-foreground">{diagnostic.summary}</span>
                                </span>
                                {diagnostic.status?.completed && <CheckCircle2 className="size-5 shrink-0 text-ok" aria-label="Résolu" />}
                            </Link>
                        </li>
                    ))}
                </ul>
            </Section>
        </>
    );
}
