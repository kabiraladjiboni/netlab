import { Link } from '@inertiajs/react';
import { AlertTriangle, GraduationCap, MapPin, ScanSearch, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAssistantContext } from '@/components/assistant/assistant-provider';
import { PageHeader, Section } from '@/components/content/page-header';
import { ScenarioPlayer } from '@/components/engine/scenario-player';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { DeviceIcon } from '@/components/scene/device-icon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { NodeKind } from '@/engine/types';
import { useMediaQuery } from '@/hooks/use-media-query';
import { architectures } from '@/scenarios/architectures';
import { cn } from '@/lib/utils';
import { OSI_NAMES, osiLayerColor } from '@/lib/labels';
import type { Quiz } from '@/types/content';

type Equipment = {
    slug: string;
    name: string;
    icon: NodeKind;
    category: string;
    function: string;
    problems: string;
    examines: string;
    placement: string;
    confusions: string[];
    layers: number[];
    protocols: { slug: string; acronym: string }[];
};

export default function EquipmentPage({ equipment, quiz, initialEquipment }: { equipment: Equipment[]; quiz: Quiz | null; initialEquipment: string | null }) {
    const [selected, setSelected] = useState<string | null>(initialEquipment);
    const [architecture, setArchitecture] = useState(architectures[0].id);
    const mobile = useMediaQuery('(max-width: 639px)');
    const current = equipment.find((item) => item.slug === selected);
    const scenario = architectures.find((item) => item.id === architecture)!;

    useAssistantContext({ page: 'equipements', title: 'Équipements réseau', focus: current?.name, excerpt: current?.function });

    useEffect(() => {
        if (initialEquipment) setSelected(initialEquipment);
    }, [initialEquipment]);

    const categories = Array.from(new Set(equipment.map((item) => item.category)));

    return (
        <>
            <PageHeader
                eyebrow="Architecture"
                title="Les équipements et ce qu’ils regardent"
                description="Chaque équipement prend ses décisions en lisant une partie précise des messages : l’adresse MAC, l’adresse IP, les ports ou le contenu. C’est la meilleure façon de ne plus confondre routeur, commutateur et pare-feu."
            />

            {categories.map((category) => (
                <Section key={category} title={category}>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {equipment
                            .filter((item) => item.category === category)
                            .map((item) => (
                                <li key={item.slug}>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(item.slug)}
                                        className="group flex h-full w-full flex-col rounded-2xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-signal/50"
                                    >
                                        <svg viewBox="-50 -40 100 80" className="h-16 w-20" aria-hidden>
                                            <DeviceIcon kind={item.icon} />
                                        </svg>
                                        <span className="mt-2 font-display text-base font-semibold group-hover:text-signal">{item.name}</span>
                                        <span className="mt-1 line-clamp-3 text-sm text-muted-foreground">{item.function}</span>
                                        <span className="mt-3 flex flex-wrap gap-1">
                                            {item.layers.map((layer) => (
                                                <span key={layer} className="inline-flex items-center gap-1 rounded-md bg-night-700 px-1.5 py-0.5 font-mono text-[10.5px]">
                                                    <span className={cn('size-1.5 rounded-full', osiLayerColor(layer))} aria-hidden />
                                                    L{layer}
                                                </span>
                                            ))}
                                        </span>
                                    </button>
                                </li>
                            ))}
                    </ul>
                </Section>
            ))}

            <Section title="Architectures types, animées" description="Le même vocabulaire, assemblé : où se place chaque équipement et par où passe le trafic.">
                <div role="tablist" aria-label="Architectures" className="mb-4 flex flex-wrap gap-2">
                    {architectures.map((item) => (
                        <button
                            key={item.id}
                            role="tab"
                            aria-selected={architecture === item.id}
                            onClick={() => setArchitecture(item.id)}
                            className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', architecture === item.id ? 'border-signal bg-signal/15' : 'border-line text-muted-foreground hover:text-foreground')}
                        >
                            {item.title}
                        </button>
                    ))}
                </div>
                <p className="mb-4 text-sm text-muted-foreground">{scenario.summary}</p>
                <ScenarioPlayer key={scenario.id} scenario={scenario} contextTitle={`Architecture : ${scenario.title}`} />
            </Section>

            {quiz && (
                <Section title={<span className="flex items-center gap-2"><GraduationCap className="size-6 text-signal" aria-hidden /> Vérifier ses connaissances</span>}>
                    <div className="max-w-3xl">
                        <QuizRunner quiz={quiz} />
                    </div>
                </Section>
            )}

            <Sheet open={!!current} onOpenChange={(open) => !open && setSelected(null)}>
                <SheetContent side={mobile ? 'bottom' : 'right'} className={cn('overflow-y-auto p-6 scrollbar-thin', mobile ? 'max-h-[88dvh] rounded-t-3xl' : 'w-full sm:max-w-lg')}>
                    {current && (
                        <>
                            <SheetHeader className="p-0">
                                <svg viewBox="-50 -40 100 80" className="h-20 w-24" aria-hidden>
                                    <DeviceIcon kind={current.icon} />
                                </svg>
                                <SheetTitle className="font-display text-2xl">{current.name}</SheetTitle>
                                <SheetDescription>{current.category}</SheetDescription>
                            </SheetHeader>
                            <p className="leading-relaxed">{current.function}</p>
                            <dl className="space-y-4 text-sm">
                                <div>
                                    <dt className="flex items-center gap-2 font-semibold">
                                        <Target className="size-4 text-signal" aria-hidden /> Problèmes résolus
                                    </dt>
                                    <dd className="mt-1 text-foreground/85">{current.problems}</dd>
                                </div>
                                <div>
                                    <dt className="flex items-center gap-2 font-semibold">
                                        <ScanSearch className="size-4 text-signal" aria-hidden /> Informations examinées
                                    </dt>
                                    <dd className="mt-1 text-foreground/85">{current.examines}</dd>
                                    <dd className="mt-2 flex flex-wrap gap-1">
                                        {current.layers.map((layer) => (
                                            <Link key={layer} href={`/modeles/osi?couche=${layer}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs hover:border-signal/60">
                                                <span className={cn('size-2 rounded-full', osiLayerColor(layer))} aria-hidden />
                                                {layer}. {OSI_NAMES[layer - 1]}
                                            </Link>
                                        ))}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="flex items-center gap-2 font-semibold">
                                        <MapPin className="size-4 text-signal" aria-hidden /> Place dans l’architecture
                                    </dt>
                                    <dd className="mt-1 text-foreground/85">{current.placement}</dd>
                                </div>
                                {current.confusions.length > 0 && (
                                    <div>
                                        <dt className="flex items-center gap-2 font-semibold">
                                            <AlertTriangle className="size-4 text-warn" aria-hidden /> Confusions courantes
                                        </dt>
                                        <dd>
                                            <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/85">
                                                {current.confusions.map((item) => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ul>
                                        </dd>
                                    </div>
                                )}
                                {current.protocols.length > 0 && (
                                    <div>
                                        <dt className="font-semibold">Protocoles associés</dt>
                                        <dd className="mt-2 flex flex-wrap gap-1.5">
                                            {current.protocols.map((protocol) => (
                                                <Link key={protocol.slug} href={`/protocoles/${protocol.slug}`} className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs hover:border-signal/60 hover:text-signal">
                                                    {protocol.acronym}
                                                </Link>
                                            ))}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
