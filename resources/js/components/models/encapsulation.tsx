import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { renderInline } from '@/components/content/rich-text';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

/**
 * Animation de l'encapsulation puis de la désencapsulation d'une requête Web.
 * Les blocs sont ajoutés (émission) puis retirés (réception) couche par couche.
 */

type BlockId = 'data' | 'tcp' | 'ip' | 'eth' | 'fcs';

type Block = { id: BlockId; label: string; size: string; className: string; fields: { name: string; value: string }[] };

const BLOCKS: Record<BlockId, Block> = {
    data: {
        id: 'data',
        label: 'Données',
        size: 'requête HTTP chiffrée par TLS',
        className: 'bg-layer-app/25 border-layer-app/70 text-layer-app',
        fields: [
            { name: 'Contenu', value: 'GET / HTTP/1.1 — Host: www.example.com' },
            { name: 'Protection', value: 'chiffré par TLS (enregistrement Application Data)' },
        ],
    },
    tcp: {
        id: 'tcp',
        label: 'En-tête TCP',
        size: '20 à 60 octets',
        className: 'bg-layer-transport/25 border-layer-transport/70 text-layer-transport',
        fields: [
            { name: 'Port source', value: '51514' },
            { name: 'Port destination', value: '443' },
            { name: 'Numéros', value: 'séquence, acquittement' },
            { name: 'Drapeaux', value: 'PSH, ACK' },
        ],
    },
    ip: {
        id: 'ip',
        label: 'En-tête IP',
        size: '20 octets (IPv4 sans option)',
        className: 'bg-layer-network/25 border-layer-network/70 text-layer-network',
        fields: [
            { name: 'IP source', value: '192.168.1.10' },
            { name: 'IP destination', value: '198.51.100.20' },
            { name: 'TTL', value: '64' },
            { name: 'Protocole', value: '6 (TCP)' },
        ],
    },
    eth: {
        id: 'eth',
        label: 'En-tête Ethernet',
        size: '14 octets',
        className: 'bg-layer-link/20 border-layer-link/70 text-layer-link',
        fields: [
            { name: 'MAC destination', value: '00:00:5e:00:53:01 (box)' },
            { name: 'MAC source', value: '00:00:5e:00:53:0a (ordinateur)' },
            { name: 'EtherType', value: '0x0800 (IPv4)' },
        ],
    },
    fcs: {
        id: 'fcs',
        label: 'FCS',
        size: '4 octets',
        className: 'bg-layer-link/20 border-layer-link/70 text-layer-link',
        fields: [{ name: 'Contrôle', value: 'CRC-32 calculé sur toute la trame' }],
    },
};

export type EncapsulationStep = {
    side: 'send' | 'wire' | 'receive';
    blocks: BlockId[];
    osi: number[];
    tcpip: number;
    unit: string;
    title: string;
    text: string;
};

const STEPS: EncapsulationStep[] = [
    { side: 'send', blocks: ['data'], osi: [7, 6, 5], tcpip: 4, unit: 'Données', title: 'Le navigateur prépare sa requête', text: 'L’application produit les **données** : une requête HTTP, chiffrée par TLS (rôle souvent associé aux couches session et présentation du modèle OSI).' },
    { side: 'send', blocks: ['tcp', 'data'], osi: [4], tcpip: 3, unit: 'Segment', title: 'La couche transport ajoute ses informations', text: 'TCP ajoute un en-tête avec les **ports** (51514 → 443) et les numéros de séquence : on obtient un **segment**.' },
    { side: 'send', blocks: ['ip', 'tcp', 'data'], osi: [3], tcpip: 2, unit: 'Paquet', title: 'La couche réseau ajoute les adresses IP', text: 'IP ajoute l’adresse source et l’adresse de destination finale : on obtient un **paquet**.' },
    { side: 'send', blocks: ['eth', 'ip', 'tcp', 'data', 'fcs'], osi: [2], tcpip: 1, unit: 'Trame', title: 'La couche liaison emballe le tout dans une trame', text: 'Ethernet ajoute les **adresses MAC** du lien local (vers la box) devant, et un code de contrôle (FCS) derrière : on obtient une **trame**.' },
    { side: 'wire', blocks: ['eth', 'ip', 'tcp', 'data', 'fcs'], osi: [1], tcpip: 1, unit: 'Bits', title: 'La couche physique transmet des bits', text: 'La trame devient une suite de **bits** transmis sous forme de signaux électriques, lumineux ou radio.' },
    { side: 'receive', blocks: ['ip', 'tcp', 'data'], osi: [2], tcpip: 1, unit: 'Paquet', title: 'À l’arrivée, la couche liaison ouvre la trame', text: 'Le récepteur vérifie le FCS, constate que la trame lui est destinée, retire l’en-tête Ethernet et transmet le **paquet** à IP (EtherType 0x0800).' },
    { side: 'receive', blocks: ['tcp', 'data'], osi: [3], tcpip: 2, unit: 'Segment', title: 'La couche réseau retire l’en-tête IP', text: 'IP vérifie que l’adresse de destination est la sienne, retire son en-tête et remet le **segment** à TCP (protocole 6).' },
    { side: 'receive', blocks: ['data'], osi: [4], tcpip: 3, unit: 'Données', title: 'La couche transport retire l’en-tête TCP', text: 'TCP remet les données dans l’ordre, acquitte, puis les livre au programme qui écoute sur le **port 443**.' },
    { side: 'receive', blocks: ['data'], osi: [7, 6, 5], tcpip: 4, unit: 'Données', title: 'Le serveur reçoit la requête', text: 'TLS déchiffre, puis le serveur Web lit la requête HTTP. Chaque couche n’a lu que **son** en-tête : c’est la **désencapsulation**.' },
];

export const ENCAPSULATION_STEPS = STEPS;

export function EncapsulationAnimation({ model, onStep }: { model: 'osi' | 'tcpip'; onStep?: (step: EncapsulationStep) => void }) {
    const { reducedMotion } = usePreferences();
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [selected, setSelected] = useState<BlockId | null>(null);
    const step = STEPS[index];

    useEffect(() => {
        if (!playing) return;
        if (index >= STEPS.length - 1) {
            setPlaying(false);
            return;
        }
        const timer = window.setTimeout(() => setIndex((value) => value + 1), 3600);
        return () => window.clearTimeout(timer);
    }, [playing, index]);

    useEffect(() => {
        onStep?.(step);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, model]);

    const go = (value: number) => {
        setPlaying(false);
        setIndex(Math.max(0, Math.min(STEPS.length - 1, value)));
    };

    const layerLabel =
        model === 'osi'
            ? `Couche${step.osi.length > 1 ? 's' : ''} OSI ${step.osi.join(', ')}`
            : `Couche TCP/IP ${step.tcpip} — ${['Accès réseau', 'Internet', 'Transport', 'Application'][step.tcpip - 1]}`;
    const selectedBlock = selected && step.blocks.includes(selected) ? BLOCKS[selected] : null;

    return (
        <div className="rounded-3xl border border-line bg-surface p-4 sm:p-6" aria-label="Animation de l’encapsulation">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs font-semibold tracking-wide uppercase">
                <span className={cn('rounded-full px-2.5 py-1', step.side === 'send' ? 'bg-signal text-on-accent' : 'bg-night-700 text-muted-foreground')}>Émetteur</span>
                <div className="relative h-1 rounded-full bg-night-700" aria-hidden>
                    <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-signal to-ok" animate={{ width: `${(index / (STEPS.length - 1)) * 100}%` }} transition={{ duration: reducedMotion ? 0 : 0.5 }} />
                </div>
                <span className={cn('rounded-full px-2.5 py-1', step.side === 'receive' ? 'bg-ok text-on-accent' : 'bg-night-700 text-muted-foreground')}>Récepteur</span>
            </div>

            <div className="mt-6 flex min-h-36 flex-col items-center justify-center gap-4">
                <p className="text-xs font-medium text-muted-foreground">
                    {layerLabel} · unité : <span className="font-semibold text-foreground">{step.unit}</span>
                </p>
                {step.side === 'wire' ? (
                    <div className="w-full overflow-hidden" aria-label="Suite de bits">
                        <motion.p
                            className="font-mono text-sm tracking-[0.3em] whitespace-nowrap text-signal"
                            initial={{ x: '-30%' }}
                            animate={reducedMotion ? { x: 0 } : { x: ['-30%', '0%'] }}
                            transition={{ duration: 3, ease: 'linear' }}
                        >
                            00000000 00000000 01011110 00000000 01010011 00000001 00000000 00000000 01011110 00000000 01010011 00001010 00001000 00000000 …
                        </motion.p>
                        <p className="mt-2 text-center text-[11px] text-muted-foreground">Début de la trame : MAC destination, MAC source, puis EtherType 0x0800 (précédés sur le câble d’un préambule de synchronisation).</p>
                    </div>
                ) : (
                    <LayoutGroup>
                        <div className="flex w-full flex-wrap items-stretch justify-center gap-1.5" role="list">
                            <AnimatePresence mode="popLayout" initial={false}>
                                {step.blocks.map((id) => {
                                    const block = BLOCKS[id];
                                    return (
                                        <motion.button
                                            key={id}
                                            type="button"
                                            role="listitem"
                                            layout={!reducedMotion}
                                            initial={reducedMotion ? false : { opacity: 0, y: step.side === 'send' ? -24 : 0, scale: 0.9 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.9, transition: { duration: 0.4 } }}
                                            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                                            onClick={() => setSelected(selected === id ? null : id)}
                                            aria-pressed={selected === id}
                                            className={cn(
                                                'rounded-xl border-2 px-3 py-3 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-signal sm:px-4',
                                                block.className,
                                                id === 'data' ? 'min-w-[7.5rem] flex-1 sm:max-w-xs' : 'shrink-0',
                                                selected === id && 'ring-2 ring-foreground/60',
                                            )}
                                        >
                                            <span className="block text-sm font-semibold">{block.label}</span>
                                            <span className="block text-[11px] opacity-80">{block.size}</span>
                                        </motion.button>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </LayoutGroup>
                )}
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={index} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-6">
                    <h3 className="font-display text-lg font-semibold" aria-live="polite">
                        {index + 1}. {step.title}
                    </h3>
                    <p className="prose-net mt-1.5">{renderInline(step.text)}</p>
                </motion.div>
            </AnimatePresence>

            {selectedBlock && (
                <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-2xl border border-line bg-night-900/60 p-4 text-sm sm:grid-cols-[auto_1fr]">
                    <p className="mb-1 font-semibold sm:col-span-2">{selectedBlock.label}</p>
                    {selectedBlock.fields.map((field) => (
                        <div key={field.name} className="contents">
                            <dt className="text-muted-foreground">{field.name}</dt>
                            <dd className="font-mono text-[13px]">{field.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {!selectedBlock && step.side !== 'wire' && <p className="mt-4 text-xs text-muted-foreground">Clique sur un bloc pour voir ses principaux champs.</p>}

            <div className="mt-5 flex items-center justify-center gap-2" role="toolbar" aria-label="Contrôles de l’animation d’encapsulation">
                <button type="button" onClick={() => go(0)} className="rounded-full p-2.5 hover:bg-night-700" aria-label="Recommencer">
                    <RotateCcw className="size-4" aria-hidden />
                </button>
                <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="rounded-full p-2.5 hover:bg-night-700 disabled:opacity-30" aria-label="Étape précédente">
                    <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (index >= STEPS.length - 1) setIndex(0);
                        setPlaying((value) => !value);
                    }}
                    className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-signal to-[color-mix(in_oklab,var(--color-signal)_70%,var(--color-gold))] text-on-accent"
                    aria-label={playing ? 'Pause' : 'Lecture'}
                >
                    {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden />}
                </button>
                <button type="button" onClick={() => go(index + 1)} disabled={index === STEPS.length - 1} className="rounded-full p-2.5 hover:bg-night-700 disabled:opacity-30" aria-label="Étape suivante">
                    <ChevronRight className="size-5" aria-hidden />
                </button>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {index + 1}/{STEPS.length}
                </span>
            </div>
        </div>
    );
}
