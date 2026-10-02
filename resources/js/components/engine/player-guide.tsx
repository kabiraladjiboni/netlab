import { ArrowRight, Eye, MousePointerClick, Play, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toneColor } from '@/components/scene/network-scene';
import type { PacketTone, Scenario, ScenarioStep } from '@/engine/types';
import { useStoredValue } from '@/lib/storage';

export const TONE_LABELS: Record<PacketTone, string> = {
    request: 'Demande',
    response: 'Réponse',
    control: 'Contrôle',
    secure: 'Chiffré',
    broadcast: 'Diffusion',
    error: 'Erreur / perdu',
};

/** Légende des couleurs de paquets utilisées dans l'étape. */
export function ToneLegend({ tones }: { tones: PacketTone[] }) {
    if (tones.length === 0) return <span />;
    return (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Signification des couleurs de paquets">
            {tones.map((tone) => (
                <li key={tone} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: toneColor[tone] }} aria-hidden />
                    {TONE_LABELS[tone]}
                </li>
            ))}
        </ul>
    );
}

/**
 * « Où regarder ? » : une ligne qui dit, en mots simples, qui parle à qui
 * pendant l'étape. Les équipements concernés sont aussi mis en avant sur
 * le schéma (les autres sont estompés).
 */
export function StepCue({ scenario, step, index, total }: { scenario: Scenario; step: ScenarioStep; index: number; total: number }) {
    const label = (id: string) => scenario.nodes.find((node) => node.id === id)?.label ?? id;
    const first = step.packets[0];
    const route = first ? `${label(first.path[0])} → ${label(first.path[first.path.length - 1])}` : step.focus.map(label).join(' · ');

    return (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-night-850/70 px-3 py-2 text-sm">
            <span className="shrink-0 rounded-lg bg-signal/15 px-2 py-1 font-mono text-xs font-semibold text-signal">
                {index + 1}/{total}
            </span>
            <span className="flex min-w-0 items-center gap-2">
                <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">
                    <span className="text-muted-foreground">Regarde : </span>
                    <strong className="font-semibold">{route || step.title}</strong>
                    {step.packets.length > 1 && <span className="text-muted-foreground"> · {step.packets.length} messages</span>}
                </span>
            </span>
        </div>
    );
}

const STORAGE_KEY = 'netlab.playerGuideSeen';

/** Trois repères affichés une seule fois, au premier TP. */
export function FirstRunGuide() {
    // Masqué pendant le rendu serveur, affiché ensuite si le guide n'a jamais été fermé.
    const [seen, setSeen] = useStoredValue<boolean>(STORAGE_KEY, false, true);
    const visible = !seen;
    const close = () => setSeen(true);
    const tips = [
        { icon: Play, title: 'Lance l’animation', text: 'Bouton ▶ ou barre Espace. Les flèches ← → passent d’une étape à l’autre.' },
        { icon: Eye, title: 'Suis le paquet coloré', text: 'Les équipements concernés sont en surbrillance, les autres s’estompent.' },
        { icon: MousePointerClick, title: 'Clique pour examiner', text: 'Un équipement ou un paquet ouvre son explication détaillée.' },
    ];
    return (
        <AnimatePresence>
            {visible && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center bg-overlay p-3 backdrop-blur-[2px]">
                    <div className="w-full max-w-lg rounded-2xl border border-line bg-popover p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <p className="font-display text-lg font-semibold">Comment lire cette animation</p>
                            <button type="button" onClick={close} aria-label="Fermer le guide" className="text-muted-foreground hover:text-foreground">
                                <X className="size-5" aria-hidden />
                            </button>
                        </div>
                        <ol className="mt-4 space-y-3">
                            {tips.map((tip, index) => (
                                <li key={tip.title} className="flex gap-3">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal/15 font-mono text-sm font-semibold text-signal">{index + 1}</span>
                                    <span className="text-sm">
                                        <strong className="block">{tip.title}</strong>
                                        <span className="text-muted-foreground">{tip.text}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <button type="button" onClick={close} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent">
                            J’ai compris <ArrowRight className="size-4" aria-hidden />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
