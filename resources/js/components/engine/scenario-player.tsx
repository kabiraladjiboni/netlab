import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, CircleCheck, Eye, EyeOff, Info, Lock, MessageCircleQuestion, MousePointerClick, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAssistant, useAssistantContext } from '@/components/assistant/assistant-provider';
import { plainText, renderInline, RichText } from '@/components/content/rich-text';
import { NetworkScene, toneColor } from '@/components/scene/network-scene';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { TimedPacket } from '@/engine/timeline';
import { textFor } from '@/engine/types';
import type { Scenario, StepStatus } from '@/engine/types';
import { useScenarioPlayer } from '@/engine/use-scenario-player';
import { usePlayerShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';
import { PacketInspector } from './packet-inspector';
import { FirstRunGuide, StepCue, ToneLegend } from './player-guide';
import { PlayerControls } from './player-controls';
import { StepProgress } from './step-progress';
import { MemoryTable, TransformCard } from './transform-view';

const statusMeta: Record<StepStatus, { label: string; icon: typeof Info; className: string }> = {
    info: { label: 'Étape', icon: Info, className: 'text-signal bg-signal/12' },
    ok: { label: 'Réussite', icon: CircleCheck, className: 'text-ok bg-ok/12' },
    warning: { label: 'Attention', icon: TriangleAlert, className: 'text-warn bg-warn/12' },
    error: { label: 'Erreur', icon: CircleAlert, className: 'text-danger bg-danger/12' },
};

type Selection = { type: 'node'; id: string } | { type: 'packet'; id: string; inspect?: string; label: string } | null;

export type ScenarioPlayerProps = {
    scenario: Scenario;
    /** Titre utilisé comme contexte pour l'assistant. */
    contextTitle: string;
    onFinished?: () => void;
    compact?: boolean;
    /** Étape d'ouverture (reprise d'un TP). */
    initialStep?: number;
    /** Appelé à chaque étape affichée (sauvegarde de la progression). */
    onStepChange?: (index: number) => void;
    /** Aperçu public : seules les N premières étapes sont jouables. */
    stepLimit?: number;
    /** Contenu affiché par-dessus la scène à la fin de l'aperçu. */
    lockedSlot?: ReactNode;
    /** Afficher le guide de première utilisation. */
    guide?: boolean;
};

export function ScenarioPlayer({ scenario: fullScenario, contextTitle, onFinished, compact = false, initialStep, onStepChange, stepLimit, lockedSlot, guide = true }: ScenarioPlayerProps) {
    const limited = stepLimit !== undefined && stepLimit < fullScenario.steps.length;
    const scenario = useMemo(() => (limited ? { ...fullScenario, steps: fullScenario.steps.slice(0, stepLimit) } : fullScenario), [fullScenario, limited, stepLimit]);
    const { level, reducedMotion } = usePreferences();
    const portrait = useMediaQuery('(max-width: 639px)');
    const desktop = useMediaQuery('(min-width: 1024px)');
    const assistant = useAssistant();
    const [showDetails, setShowDetails] = useState(level >= 3);
    const [selection, setSelection] = useState<Selection>(null);

    const player = useScenarioPlayer(scenario, (index) => plainText(textFor(scenario.steps[index]?.text, level)));
    const { state, dispatch, step, timeline, time } = player;
    const status = step.status ?? 'info';
    const meta = statusMeta[status];
    const stepText = textFor(step.text, level);
    const mainPacket = step.details ? scenario.packets[step.details] : undefined;

    usePlayerShortcuts({
        space: () => dispatch({ type: 'toggle' }),
        left: () => dispatch({ type: 'prev' }),
        right: () => dispatch({ type: 'next' }),
        r: () => dispatch({ type: 'replay' }),
    });

    // Reprise : on se place sur l'étape enregistrée (une seule fois).
    const resumed = useRef(false);
    useEffect(() => {
        if (resumed.current || !initialStep) return;
        resumed.current = true;
        dispatch({ type: 'goto', index: Math.min(initialStep, scenario.steps.length - 1) });
        dispatch({ type: 'pause' });
    }, [initialStep, dispatch, scenario.steps.length]);

    const onStepRef = useRef(onStepChange);
    onStepRef.current = onStepChange;
    useEffect(() => {
        onStepRef.current?.(state.index);
    }, [state.index, scenario.id]);

    useEffect(() => {
        if (state.status === 'ended') onFinished?.();
    }, [state.status, onFinished]);

    useEffect(() => setSelection(null), [scenario.id]);

    useAssistantContext({
        page: 'lesson',
        title: contextTitle,
        focus: `Étape ${state.index + 1} : ${step.title}`,
        excerpt: plainText(stepText).slice(0, 1200),
        concepts: step.terms,
    });

    const selectPacket = (packet: TimedPacket) => {
        dispatch({ type: 'pause' });
        setSelection({ type: 'packet', id: packet.id, inspect: packet.inspect, label: packet.label });
    };

    const selectedNode = selection?.type === 'node' ? scenario.nodes.find((node) => node.id === selection.id) : undefined;
    const selectedPacketDetails = selection?.type === 'packet' && selection.inspect ? scenario.packets[selection.inspect] : undefined;

    const panel = (
        <div className="space-y-4">
            <AnimatePresence mode="wait">
                <motion.div
                    key={`${scenario.id}-${step.id}-${level}`}
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', meta.className)}>
                            <meta.icon className="size-3.5" aria-hidden />
                            {meta.label} {state.index + 1}
                        </span>
                    </div>
                    <h2 className="font-display text-xl leading-snug font-semibold sm:text-2xl" aria-live="polite">
                        {step.title}
                    </h2>
                    <RichText text={stepText} />
                    {step.simplification && (
                        <p className="flex gap-2 rounded-xl border border-line bg-night-900/50 p-3 text-xs leading-relaxed text-muted-foreground">
                            <Info className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden />
                            <span>
                                <strong className="text-foreground/90">Simplification pédagogique — </strong>
                                {renderInline(step.simplification)}
                            </span>
                        </p>
                    )}
                </motion.div>
            </AnimatePresence>

            {step.transform && <TransformCard view={step.transform} reducedMotion={reducedMotion} playKey={`${step.id}-${state.epoch}`} />}
            {step.table && <MemoryTable table={step.table} reducedMotion={reducedMotion} />}

            {step.packets.length > 0 && (
                <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MousePointerClick className="size-3.5" aria-hidden /> Messages de cette étape (clique pour les examiner)
                    </p>
                    <ul className="flex flex-wrap gap-2">
                        {timeline.packets.map((packet) => (
                            <li key={packet.id}>
                                <button
                                    type="button"
                                    onClick={() => selectPacket(packet)}
                                    disabled={!packet.inspect}
                                    className="inline-flex items-center gap-2 rounded-full border border-line bg-night-900/60 px-3 py-1.5 font-mono text-xs transition-colors hover:border-signal/60 disabled:cursor-default disabled:opacity-70"
                                    aria-label={`Examiner le message ${packet.label}`}
                                >
                                    <span className="size-2 rounded-full" style={{ background: toneColor[packet.tone] }} aria-hidden />
                                    {packet.label}
                                    {packet.lost && <span className="text-danger">✕</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {mainPacket && (
                    <button
                        type="button"
                        onClick={() => setShowDetails((value) => !value)}
                        aria-expanded={showDetails}
                        className="inline-flex items-center gap-2 rounded-full border border-line bg-night-800 px-3.5 py-2 text-sm font-medium transition-colors hover:border-signal/60"
                    >
                        {showDetails ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                        {showDetails ? 'Masquer les détails techniques' : 'Afficher les détails techniques'}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => {
                        dispatch({ type: 'pause' });
                        assistant.open(undefined);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 px-3.5 py-2 text-sm font-medium text-signal transition-colors hover:bg-signal/20"
                >
                    <MessageCircleQuestion className="size-4" aria-hidden /> Poser une question
                </button>
            </div>

            <AnimatePresence initial={false}>
                {showDetails && mainPacket && (
                    <motion.div
                        key={`${step.id}-${level}`}
                        initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-2xl border border-line bg-night-900/40 p-3 sm:p-4">
                            <PacketInspector key={`${mainPacket.id}-${level}`} packet={mainPacket} level={level} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <div className={cn('grid gap-5', !compact && 'lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] xl:gap-7')}>
            <div className="min-w-0 space-y-3">
                <StepCue scenario={scenario} step={step} index={state.index} total={fullScenario.steps.length} />
                <div className="glass grid-bg relative overflow-hidden rounded-3xl p-2 sm:p-4">
                    {guide && <FirstRunGuide />}
                    <NetworkScene
                        scenario={scenario}
                        step={step}
                        timeline={timeline}
                        time={time}
                        portrait={portrait}
                        reducedMotion={reducedMotion}
                        selectedNode={selection?.type === 'node' ? selection.id : null}
                        selectedPacket={selection?.type === 'packet' ? selection.id : null}
                        onSelectNode={(id) => setSelection({ type: 'node', id })}
                        onSelectPacket={selectPacket}
                        className={portrait ? 'mx-auto max-w-[26rem]' : undefined}
                    />
                    {limited && state.status === 'ended' && lockedSlot && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm">
                            <div className="w-full max-w-md">{lockedSlot}</div>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <ToneLegend tones={[...new Set(step.packets.map((packet) => packet.tone))]} />
                    {limited ? (
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-warn">
                            <Lock className="size-3.5" aria-hidden /> Aperçu : {scenario.steps.length} étapes sur {fullScenario.steps.length}
                        </p>
                    ) : (
                        <p className="hidden text-[11px] text-muted-foreground sm:block">Clique sur un équipement ou un paquet pour l’examiner</p>
                    )}
                </div>
                <div className="sticky bottom-2 z-20 space-y-2 sm:static">
                    <div className="glass rounded-2xl px-3 pt-2 pb-1 sm:bg-transparent sm:p-0 sm:backdrop-blur-none sm:[border:none]">
                        <StepProgress steps={scenario.steps} index={state.index} onSelect={(index) => dispatch({ type: 'goto', index })} time={time} duration={timeline.duration} />
                    </div>
                    <PlayerControls state={state} dispatch={dispatch} isFirst={player.isFirst} stepLabel={`Étape ${state.index + 1} : ${step.title}`} />
                </div>
                {!desktop && !compact && <div className="pt-2">{panel}</div>}
            </div>
            {(desktop || compact) && <aside className={cn('min-w-0', !compact && 'lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 scrollbar-thin')}>{panel}</aside>}

            <Sheet open={selection !== null} onOpenChange={(open) => !open && setSelection(null)}>
                <SheetContent side={portrait ? 'bottom' : 'right'} className={cn('overflow-y-auto p-5 scrollbar-thin', portrait ? 'max-h-[85dvh] rounded-t-3xl' : 'w-full sm:max-w-lg')}>
                    {selectedNode && (
                        <>
                            <SheetHeader className="p-0">
                                <SheetTitle className="font-display text-xl">{selectedNode.label}</SheetTitle>
                                {selectedNode.sublabel && <SheetDescription className="font-mono">{selectedNode.sublabel}</SheetDescription>}
                            </SheetHeader>
                            <RichText text={textFor(selectedNode.description, level)} />
                            {selectedNode.facts && (
                                <dl className="divide-y divide-line/60 rounded-xl border border-line bg-night-900/50 px-3">
                                    {selectedNode.facts
                                        .filter((fact) => (fact.level ?? 1) <= level)
                                        .map((fact) => (
                                            <div key={fact.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 py-2 text-sm">
                                                <dt className="text-muted-foreground">{fact.label}</dt>
                                                <dd className="font-mono text-[13px] break-all">{fact.value}</dd>
                                            </div>
                                        ))}
                                </dl>
                            )}
                            {level < 3 && selectedNode.facts?.some((fact) => (fact.level ?? 1) > level) && (
                                <p className="text-xs text-muted-foreground">D'autres informations apparaissent aux niveaux supérieurs.</p>
                            )}
                        </>
                    )}
                    {selection?.type === 'packet' && (
                        <>
                            <SheetHeader className="p-0">
                                <SheetTitle className="font-display text-xl">Message « {selection.label} »</SheetTitle>
                                <SheetDescription>L'animation est en pause pendant que tu examines ce message.</SheetDescription>
                            </SheetHeader>
                            {selectedPacketDetails ? (
                                <PacketInspector key={`${selectedPacketDetails.id}-${level}`} packet={selectedPacketDetails} level={level} />
                            ) : (
                                <p className="text-sm text-muted-foreground">Ce message n'a pas de détails supplémentaires dans ce scénario.</p>
                            )}
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

