import { Link } from '@inertiajs/react';
import { ArrowRight, GraduationCap, Info } from 'lucide-react';
import { useState } from 'react';
import { useAssistantContext } from '@/components/assistant/assistant-provider';
import { PageHeader, Section } from '@/components/content/page-header';
import { EncapsulationAnimation } from '@/components/models/encapsulation';
import type { EncapsulationStep } from '@/components/models/encapsulation';
import { LayerExplorer } from '@/components/models/layer-explorer';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { progressStore } from '@/hooks/use-progress';
import type { LayerInfo, Quiz } from '@/types/content';

export default function Osi({ layers, quiz, initialLayer }: { layers: LayerInfo[]; tcpip: LayerInfo[]; quiz: Quiz | null; initialLayer: number }) {
    const [selected, setSelected] = useState(initialLayer);
    const [step, setStep] = useState<EncapsulationStep | null>(null);
    const [visited, setVisited] = useState<Set<number>>(() => new Set([initialLayer]));

    const select = (layer: number) => {
        setSelected(layer);
        setVisited((previous) => {
            const next = new Set(previous).add(layer);
            progressStore.recordLessonStep('osi', next.size - 1, 7);
            if (next.size === 7) progressStore.completeLesson('osi', 7);
            return next;
        });
    };

    const current = layers.find((layer) => layer.number === selected);
    useAssistantContext({ page: 'modele-osi', title: 'Modèle OSI', focus: current ? `Couche ${current.number} : ${current.name}` : undefined, excerpt: current?.role });

    return (
        <>
            <PageHeader
                eyebrow="Modèles"
                title="Le modèle OSI : sept couches pour comprendre une communication"
                description="Chaque couche a une responsabilité précise et ne dialogue qu’avec ses voisines. Clique sur une couche pour la découvrir, puis regarde un message descendre les couches à l’envoi et les remonter à la réception."
            />
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <LayerExplorer layers={layers} selected={selected} onSelect={select} highlight={step?.osi ?? []} direction={step ? (step.side === 'receive' ? 'up' : 'down') : null} />
                <p className="mt-3 text-xs text-muted-foreground">Couches explorées : {visited.size} / 7 · Astuce : les flèches ↑ ↓ du clavier changent de couche.</p>
            </div>

            <Section title="L’encapsulation en action" description="Une requête Web descend les couches de l’émetteur (chaque couche ajoute son en-tête), voyage sous forme de bits, puis remonte les couches du récepteur (chaque couche retire son en-tête). La couche concernée s’allume dans la tour ci-dessus.">
                <EncapsulationAnimation model="osi" onStep={setStep} />
            </Section>

            <Section>
                <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
                    <Info className="size-6 shrink-0 text-signal" aria-hidden />
                    <p className="flex-1 text-sm leading-relaxed text-foreground/85">
                        <strong>Un modèle conceptuel.</strong> Le modèle OSI sert à raisonner sur les responsabilités. Les implémentations réelles ne correspondent pas toujours à une couche unique : TLS se place entre transport et application, ARP entre liaison et réseau, MPLS est souvent dit « couche 2,5 ». Internet s’appuie en pratique sur le modèle TCP/IP.
                    </p>
                    <Link href="/modeles/tcp-ip" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-signal hover:underline">
                        Comparer avec TCP/IP <ArrowRight className="size-4" aria-hidden />
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
