import { Link } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, BookMarked, ChevronRight, ExternalLink, FileText, GraduationCap, Lightbulb, MessageCircleQuestion, PlayCircle, Puzzle, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useAssistant, useAssistantContext } from '@/components/assistant/assistant-provider';
import { ExchangeDiagram } from '@/components/content/exchange-diagram';
import { LayerStack } from '@/components/content/layer-stack';
import { RichText } from '@/components/content/rich-text';
import { TermLink } from '@/components/content/term-link';
import { ScenarioPlayer } from '@/components/engine/scenario-player';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { EngagementBar } from '@/components/learning/engagement';
import type { Engagement } from '@/components/learning/engagement';
import { LabGate } from '@/components/learning/lab-gate';
import type { AccessStatus } from '@/components/learning/lab-gate';
import { usePreferences } from '@/hooks/use-preferences';
import { getScenarioVariants } from '@/scenarios';
import { statusLabels } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { ProtocolDetail } from '@/types/content';

type Props = {
    protocol: ProtocolDetail;
    siblings: { slug: string; acronym: string }[];
    engagement: Engagement;
    access: AccessStatus;
    draft: boolean;
};

function Block({ icon, title, children, id }: { icon: ReactNode; title: string; children: ReactNode; id?: string }) {
    return (
        <section id={id} className="scroll-mt-24 rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby={`${id ?? title}-titre`}>
            <h2 id={`${id ?? title}-titre`} className="flex items-center gap-2 font-display text-lg font-semibold">
                {icon}
                {title}
            </h2>
            <div className="mt-3">{children}</div>
        </section>
    );
}

export default function ProtocolShow({ protocol, siblings, engagement, access, draft }: Props) {
    const { level } = usePreferences();
    const assistant = useAssistant();
    const variants = useMemo(() => getScenarioVariants(protocol.scenario), [protocol.scenario]);
    const status = statusLabels[protocol.status];
    const osi = protocol.layers.filter((l) => l.model === 'osi').map((l) => l.number);
    const tcpip = protocol.layers.filter((l) => l.model === 'tcpip').map((l) => l.number);
    const index = siblings.findIndex((item) => item.slug === protocol.slug);

    useAssistantContext({
        page: 'protocole',
        title: `${protocol.acronym} — ${protocol.name}`,
        excerpt: `${protocol.summary} ${protocol.problem}`.slice(0, 1200),
        concepts: protocol.terms.map((term) => term.slug),
    });

    const groupedRelated = protocol.related.reduce<Record<string, Props['protocol']['related']>>((groups, item) => {
        (groups[item.type_label] ??= []).push(item);
        return groups;
    }, {});

    return (
        <>
            {draft && <div className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-sm text-warn">Brouillon — aperçu visible uniquement par les administrateurs.</div>}
            <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
                <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <Link href="/protocoles" className="hover:text-foreground">
                        Protocoles
                    </Link>
                    <ChevronRight className="size-3.5" aria-hidden />
                    {protocol.category && (
                        <Link href={`/protocoles#${protocol.category.slug}`} className="hover:text-foreground">
                            {protocol.category.name}
                        </Link>
                    )}
                </nav>

                <header className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', status.className)} title={status.description}>
                                {status.label}
                            </span>
                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', protocol.completeness === 'complete' ? 'bg-signal/12 text-signal' : 'bg-night-700 text-muted-foreground')}>
                                {protocol.completeness === 'complete' ? 'Fiche complète' : 'Fiche essentielle — en cours d’enrichissement'}
                            </span>
                        </div>
                        <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{protocol.acronym}</h1>
                        <p className="mt-1 text-lg text-muted-foreground">{protocol.name}</p>
                        <p className="mt-4 max-w-3xl text-lg leading-relaxed">{protocol.summary}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {protocol.lesson && (
                                <Link href={protocol.lesson.href} className="inline-flex items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent hover:brightness-110">
                                    <PlayCircle className="size-4" aria-hidden /> Leçon : {protocol.lesson.title}
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => assistant.open()}
                                className="inline-flex items-center gap-2 rounded-xl border border-signal/40 bg-signal/10 px-4 py-2.5 text-sm font-medium text-signal hover:bg-signal/20"
                            >
                                <MessageCircleQuestion className="size-4" aria-hidden /> Poser une question sur {protocol.acronym}
                            </button>
                        </div>
                    </div>
                    <aside className="rounded-3xl border border-line bg-surface p-4">
                        <LayerStack osi={osi} tcpip={tcpip} />
                        {protocol.ports.length > 0 && (
                            <div className="mt-4 border-t border-line pt-3">
                                <p className="mb-2 text-xs font-semibold text-muted-foreground">Ports et numéros</p>
                                <ul className="space-y-1.5 text-sm">
                                    {protocol.ports.map((port) => (
                                        <li key={`${port.number}-${port.transport}-${port.note ?? ''}`} className="flex flex-wrap items-baseline gap-x-2">
                                            <span className="font-mono font-semibold text-signal">{port.number}</span>
                                            <span className="font-mono text-xs">{port.transport}</span>
                                            {port.note && <span className="text-xs text-muted-foreground">— {port.note}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {protocol.ports.length === 0 && <p className="mt-4 border-t border-line pt-3 text-xs text-muted-foreground">Pas de numéro de port : ce protocole n’est pas transporté par TCP ou UDP, ou n’en a pas de fixe.</p>}
                    </aside>
                </header>
            </div>

            <div className="mx-auto mt-8 grid grid-cols-1 max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-2">
                <Block icon={<Target className="size-5 text-signal" aria-hidden />} title="Le problème résolu">
                    <RichText text={protocol.problem} />
                </Block>
                <Block icon={<Lightbulb className="size-5 text-warn" aria-hidden />} title={level === 1 ? 'Expliqué simplement' : 'En bref'}>
                    <RichText text={protocol.beginner} />
                    <p className="mt-3 rounded-xl bg-warn/8 p-3 text-sm">
                        <strong className="text-warn">Image : </strong>
                        {protocol.analogy}
                    </p>
                    {protocol.real_example && (
                        <p className="mt-3 text-sm text-muted-foreground">
                            <strong className="text-foreground/90">Dans la vraie vie : </strong>
                            {protocol.real_example}
                        </p>
                    )}
                </Block>
            </div>

            <div className="mx-auto mt-5 max-w-7xl space-y-5 px-4 sm:px-6">
                {(protocol.osi_note || protocol.tcpip_note) && (
                    <Block icon={<Puzzle className="size-5 text-layer-network" aria-hidden />} title="Position dans les modèles">
                        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            {protocol.osi_note && (
                                <div>
                                    <dt className="font-semibold">Modèle OSI</dt>
                                    <dd className="mt-1 text-muted-foreground">{protocol.osi_note}</dd>
                                </div>
                            )}
                            {protocol.tcpip_note && (
                                <div>
                                    <dt className="font-semibold">Modèle TCP/IP</dt>
                                    <dd className="mt-1 text-muted-foreground">{protocol.tcpip_note}</dd>
                                </div>
                            )}
                        </dl>
                    </Block>
                )}

                {variants && variants[0] && (
                    <Block icon={<PlayCircle className="size-5 text-signal" aria-hidden />} title="Animation interactive" id="animation">
                        <p className="mb-4 text-sm text-muted-foreground">{variants[0].scenario.summary}</p>
                        <ScenarioPlayer
                            scenario={variants[0].scenario}
                            contextTitle={`${protocol.acronym} — ${variants[0].scenario.title}`}
                            compact
                            stepLimit={protocol.lesson ? 3 : undefined}
                            lockedSlot={protocol.lesson ? <LabGate access={access} labHref={`/laboratoire/${protocol.lesson.slug}`} compact /> : undefined}
                        />
                    </Block>
                )}

                {protocol.communication.length > 0 && (
                    <Block icon={<ArrowRight className="size-5 text-signal" aria-hidden />} title="Exemple de communication" id="echange">
                        <ExchangeDiagram messages={protocol.communication} title={`Échange ${protocol.acronym} (illustratif)`} />
                    </Block>
                )}

                {level >= 2 && protocol.fields.length > 0 && (
                    <Block icon={<FileText className="size-5 text-layer-transport" aria-hidden />} title="Champs importants des messages">
                        <div className="overflow-x-auto scrollbar-thin">
                            <table className="w-full min-w-[32rem] text-left text-sm">
                                <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                                    <tr>
                                        <th scope="col" className="py-2 pr-4 font-medium">Champ</th>
                                        <th scope="col" className="py-2 pr-4 font-medium">Taille</th>
                                        <th scope="col" className="py-2 font-medium">Rôle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {protocol.fields.map((field) => (
                                        <tr key={field.name} className="border-t border-line/60 align-top">
                                            <td className="py-2.5 pr-4 font-medium">{field.name}</td>
                                            <td className="py-2.5 pr-4 font-mono text-xs whitespace-nowrap text-muted-foreground">{field.size ?? '—'}</td>
                                            <td className="py-2.5 text-foreground/85">{field.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Block>
                )}
                {level === 1 && protocol.fields.length > 0 && (
                    <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted-foreground">
                        Les champs techniques des messages sont visibles aux niveaux « Je comprends » et « J’approfondis » (sélecteur de niveau en haut de page).
                    </p>
                )}

                {protocol.packet_example && (
                    <Block icon={<FileText className="size-5 text-violet" aria-hidden />} title="Exemple de paquet ou de capture">
                        <p className="mb-2 text-sm font-medium">{protocol.packet_example.title}</p>
                        <pre className="overflow-x-auto rounded-xl border border-line bg-overlay p-4 font-mono text-[12.5px] leading-relaxed text-foreground/90 scrollbar-thin">
                            {protocol.packet_example.lines.join('\n')}
                        </pre>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {protocol.packet_example.note ?? 'Exemple pédagogique construit à la main (adresses de documentation), pas une capture réelle.'}
                        </p>
                    </Block>
                )}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {protocol.mistakes.length > 0 && (
                        <Block icon={<AlertTriangle className="size-5 text-warn" aria-hidden />} title="Erreurs courantes">
                            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
                                {protocol.mistakes.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </Block>
                    )}
                    {(protocol.limits.length > 0 || protocol.variants.length > 0) && (
                        <Block icon={<Puzzle className="size-5 text-muted-foreground" aria-hidden />} title="Limites et variantes">
                            {protocol.limits.length > 0 && (
                                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
                                    {protocol.limits.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            )}
                            {protocol.variants.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                    {protocol.variants.map((item) => (
                                        <span key={item} className="rounded-full border border-line px-2.5 py-1 text-xs">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </Block>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {protocol.related.length > 0 && (
                        <Block icon={<ArrowRight className="size-5 text-signal" aria-hidden />} title="Protocoles associés">
                            <dl className="space-y-3">
                                {Object.entries(groupedRelated).map(([label, items]) => (
                                    <div key={label}>
                                        <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{protocol.acronym} — {label}</dt>
                                        <dd className="mt-1.5 flex flex-wrap gap-2">
                                            {items.map((item) => (
                                                <Link key={item.slug} href={`/protocoles/${item.slug}`} title={item.note ?? item.name} className="rounded-full border border-line px-3 py-1 text-sm hover:border-signal/60 hover:text-signal">
                                                    {item.acronym}
                                                </Link>
                                            ))}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </Block>
                    )}
                    {protocol.terms.length > 0 && (
                        <Block icon={<BookMarked className="size-5 text-signal" aria-hidden />} title="Termes techniques associés">
                            <p className="mb-3 text-sm text-muted-foreground">Clique sur un terme pour afficher sa définition.</p>
                            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                {protocol.terms.map((term) => (
                                    <li key={term.slug}>
                                        <TermLink slug={term.slug} label={term.term} />
                                    </li>
                                ))}
                            </ul>
                        </Block>
                    )}
                </div>

                <Block icon={<ExternalLink className="size-5 text-muted-foreground" aria-hidden />} title="Références">
                    <ul className="space-y-1.5 text-sm">
                        {protocol.references.map((reference) => (
                            <li key={reference.label}>
                                {reference.url ? (
                                    <a href={reference.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-signal hover:underline">
                                        {reference.label} <ExternalLink className="size-3" aria-hidden />
                                    </a>
                                ) : (
                                    reference.label
                                )}
                            </li>
                        ))}
                    </ul>
                </Block>

                <EngagementBar engagement={engagement} type="protocol" slug={protocol.slug} className="rounded-2xl border border-line bg-surface px-4 py-3" />

                {protocol.quiz && (
                    <section aria-labelledby="quiz-titre" className="mx-auto max-w-3xl pt-4">
                        <h2 id="quiz-titre" className="flex items-center gap-2 font-display text-2xl font-semibold">
                            <GraduationCap className="size-6 text-signal" aria-hidden /> Quiz
                        </h2>
                        {protocol.quiz.description && <p className="mt-1 mb-4 text-sm text-muted-foreground">{protocol.quiz.description}</p>}
                        <QuizRunner quiz={protocol.quiz} key={protocol.slug} />
                    </section>
                )}

                <nav aria-label="Fiches de la même famille" className="flex justify-between gap-3 border-t border-line pt-6">
                    {index > 0 ? (
                        <Link href={`/protocoles/${siblings[index - 1].slug}`} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-signal/50">
                            ← {siblings[index - 1].acronym}
                        </Link>
                    ) : (
                        <span />
                    )}
                    {index < siblings.length - 1 && (
                        <Link href={`/protocoles/${siblings[index + 1].slug}`} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-signal/50">
                            {siblings[index + 1].acronym} →
                        </Link>
                    )}
                </nav>
            </div>
        </>
    );
}
