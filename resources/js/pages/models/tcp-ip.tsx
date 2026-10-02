import { Link } from '@inertiajs/react';
import { motion } from 'motion/react';
import { ArrowRight, GraduationCap, Info } from 'lucide-react';
import { useState } from 'react';
import { useAssistantContext } from '@/components/assistant/assistant-provider';
import { PageHeader, Section } from '@/components/content/page-header';
import { EncapsulationAnimation } from '@/components/models/encapsulation';
import type { EncapsulationStep } from '@/components/models/encapsulation';
import { LayerExplorer } from '@/components/models/layer-explorer';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { usePreferences } from '@/hooks/use-preferences';
import { progressStore } from '@/hooks/use-progress';
import { cn } from '@/lib/utils';
import { osiLayerColor, tcpipLayerColor } from '@/lib/labels';
import type { LayerInfo, Quiz } from '@/types/content';

const EXAMPLES: Record<number, string[]> = {
    4: ['dns', 'http-1-1', 'https', 'tls', 'ssh', 'dhcpv4'],
    3: ['tcp', 'udp', 'quic'],
    2: ['ipv4', 'ipv6', 'icmpv4'],
    1: ['ethernet', 'wifi', 'arp'],
};

export default function TcpIp({ layers, osi, quiz, initialLayer }: { layers: LayerInfo[]; osi: LayerInfo[]; quiz: Quiz | null; initialLayer: number }) {
    const { reducedMotion } = usePreferences();
    const [selected, setSelected] = useState(Math.min(4, initialLayer));
    const [step, setStep] = useState<EncapsulationStep | null>(null);
    const [mapping, setMapping] = useState(true);
    const current = layers.find((layer) => layer.number === selected)!;
    const mapped = current?.maps_to ?? [];

    useAssistantContext({ page: 'modele-tcpip', title: 'Modèle TCP/IP', focus: current ? `Couche ${current.number} : ${current.name}` : undefined, excerpt: current?.role });

    const select = (layer: number) => {
        setSelected(layer);
        progressStore.recordLessonStep('tcp-ip', layer - 1, 4);
    };

    return (
        <>
            <PageHeader
                eyebrow="Modèles"
                title="Le modèle TCP/IP : quatre couches, celles d’Internet"
                description="Plus compact que le modèle OSI, il décrit l’organisation réelle de la pile d’Internet. Active la correspondance pour voir comment ses couches recouvrent les sept couches OSI."
            />
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <LayerExplorer layers={layers} selected={selected} onSelect={select} highlight={step ? [step.tcpip] : []} direction={step ? (step.side === 'receive' ? 'up' : 'down') : null} />
            </div>

            <Section title="Correspondance avec le modèle OSI" description="Correspondance pédagogique courante. Elle n’est pas toujours exacte : certains protocoles se placent entre deux couches.">
                <label className="mb-4 inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={mapping} onChange={(event) => setMapping(event.target.checked)} className="size-4 accent-[var(--color-signal)]" />
                    Afficher les liaisons entre les deux modèles
                </label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-6">
                    <ol className="flex flex-col-reverse gap-1.5" aria-label="Couches OSI">
                        {osi.map((layer) => {
                            const lit = mapped.includes(layer.number);
                            return (
                                <motion.li
                                    key={layer.slug}
                                    animate={{ opacity: !mapping || lit ? 1 : 0.35, x: lit && mapping && !reducedMotion ? 6 : 0 }}
                                    className={cn('flex h-11 items-center gap-2 rounded-xl border px-3 text-sm', lit ? 'border-signal/60 bg-signal/10' : 'border-line bg-surface')}
                                >
                                    <span className={cn('size-2.5 rounded-full', osiLayerColor(layer.number))} aria-hidden />
                                    <span className="font-mono text-xs text-muted-foreground">{layer.number}</span> {layer.name}
                                </motion.li>
                            );
                        })}
                    </ol>
                    <div className="flex w-6 flex-col items-center justify-center sm:w-12" aria-hidden>
                        {mapping && (
                            <motion.div key={selected} initial={reducedMotion ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} className="h-0.5 w-full origin-right bg-gradient-to-l from-signal to-signal/20" />
                        )}
                    </div>
                    <ol className="flex flex-col-reverse gap-1.5" aria-label="Couches TCP/IP">
                        {layers.map((layer) => {
                            const rows = layer.maps_to.length;
                            const active = layer.number === selected;
                            return (
                                <li key={layer.slug} style={{ height: `calc(${rows} * 2.75rem + ${rows - 1} * 0.375rem)` }}>
                                    <button
                                        type="button"
                                        onClick={() => select(layer.number)}
                                        aria-pressed={active}
                                        className={cn('flex h-full w-full items-center gap-2 rounded-xl border px-3 text-left text-sm transition', active ? 'border-signal bg-signal/15 font-semibold' : 'border-line bg-surface hover:border-signal/40')}
                                    >
                                        <span className={cn('size-2.5 rounded-full', tcpipLayerColor(layer.number))} aria-hidden />
                                        {layer.name}
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </div>
                <div className="mt-6 overflow-x-auto rounded-2xl border border-line scrollbar-thin">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                        <caption className="sr-only">Exemples de protocoles par couche TCP/IP</caption>
                        <thead className="bg-night-850 text-xs tracking-wide text-muted-foreground uppercase">
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Couche TCP/IP</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Couches OSI</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Exemples</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...layers].reverse().map((layer) => (
                                <tr key={layer.slug} className={cn('border-t border-line/60', layer.number === selected && 'bg-signal/6')}>
                                    <th scope="row" className="px-4 py-3 font-medium">
                                        {layer.number}. {layer.name}
                                    </th>
                                    <td className="px-4 py-3 font-mono text-xs">{layer.maps_to.join(', ')}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {EXAMPLES[layer.number].map((slug) => {
                                                const found = layer.protocols.find((p) => p.slug === slug);
                                                return found ? (
                                                    <Link key={slug} href={`/protocoles/${slug}`} className="rounded-full border border-line px-2 py-0.5 font-mono text-xs hover:border-signal/60 hover:text-signal">
                                                        {found.acronym}
                                                    </Link>
                                                ) : null;
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            <Section title="Encapsulation et désencapsulation" description="La même requête Web, vue avec les quatre couches TCP/IP.">
                <EncapsulationAnimation model="tcpip" onStep={setStep} />
            </Section>

            <Section>
                <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
                    <Info className="size-6 shrink-0 text-signal" aria-hidden />
                    <p className="flex-1 text-sm leading-relaxed text-foreground/85">
                        Les modèles servent à comprendre qui fait quoi ; ils ne décrivent pas exactement chaque implémentation. Exemple : QUIC assure des fonctions de transport mais fonctionne au-dessus d’UDP ; certaines présentations découpent TCP/IP en cinq couches en séparant physique et liaison.
                    </p>
                    <Link href="/modeles/osi" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-signal hover:underline">
                        Revoir le modèle OSI <ArrowRight className="size-4" aria-hidden />
                    </Link>
                </div>
            </Section>

            {quiz && (
                <Section title={<span className="flex items-center gap-2"><GraduationCap className="size-6 text-signal" aria-hidden /> Vérifier ses connaissances</span>}>
                    <div className="max-w-3xl">
                        <QuizRunner quiz={quiz} />
                    </div>
                </Section>
            )}
        </>
    );
}
