import { CircleCheck, Lightbulb, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Mission } from '@/wireshark/types';

/**
 * Missions guidées : sélectionner le bon paquet ou écrire le bon filtre.
 * Une mission « filtre » est validée lorsque les paquets affichés sont exactement ceux attendus.
 */
export function Missions({ missions, selected, visible, filterApplied }: { missions: Mission[]; selected: number | null; visible: number[]; filterApplied: string }) {
    const [index, setIndex] = useState(0);
    const [done, setDone] = useState<Record<string, boolean>>({});
    const [hint, setHint] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const mission = missions[index];

    useEffect(() => {
        setIndex(0);
        setDone({});
        setHint(false);
        setFeedback(null);
    }, [missions]);

    useEffect(() => {
        if (!mission || mission.kind !== 'filter' || done[mission.id] || !filterApplied.trim()) return;
        const same = visible.length === mission.answer.length && mission.answer.every((n) => visible.includes(n));
        if (same) setDone((previous) => ({ ...previous, [mission.id]: true }));
        else setFeedback('Ce filtre n’affiche pas exactement les paquets attendus. Ajuste-le et réessaie.');
    }, [filterApplied, visible, mission, done]);

    if (!mission) return null;
    const success = done[mission.id];
    const completed = Object.keys(done).length;

    const checkSelection = () => {
        if (selected === null) {
            setFeedback('Clique d’abord sur un paquet dans la liste.');
            return;
        }
        if (mission.answer.includes(selected)) setDone((previous) => ({ ...previous, [mission.id]: true }));
        else setFeedback(`Le paquet ${selected} n’est pas le bon. Regarde sa colonne « Info ».`);
    };

    return (
        <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="missions-titre">
            <div className="flex items-center justify-between gap-2">
                <h2 id="missions-titre" className="flex items-center gap-2 font-display text-base font-semibold">
                    <Target className="size-4 text-signal" aria-hidden /> Missions
                </h2>
                <span className="font-mono text-xs text-muted-foreground">
                    {completed}/{missions.length}
                </span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
                {missions.map((item, i) => (
                    <span key={item.id} className={cn('h-1 flex-1 rounded-full', done[item.id] ? 'bg-ok' : i === index ? 'bg-signal' : 'bg-night-700')} />
                ))}
            </div>
            <p className="mt-3 text-sm font-medium" aria-live="polite">
                {index + 1}. {mission.prompt}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{mission.kind === 'select' ? 'Sélectionne le paquet dans la liste, puis vérifie.' : 'Écris le filtre dans la barre de filtre et applique-le.'}</p>

            {success ? (
                <div className="mt-3 rounded-xl border border-ok/40 bg-ok/8 p-3 text-sm" role="status">
                    <p className="flex items-center gap-1.5 font-semibold text-ok">
                        <CircleCheck className="size-4" aria-hidden /> Réussi
                    </p>
                    <p className="mt-1 text-foreground/85">{mission.explanation}</p>
                </div>
            ) : (
                <>
                    {feedback && <p className="mt-2 text-xs text-warn" role="status">{feedback}</p>}
                    {hint && (
                        <p className="mt-2 flex gap-1.5 rounded-lg bg-warn/8 p-2 text-xs">
                            <Lightbulb className="size-3.5 shrink-0 text-warn" aria-hidden /> {mission.hint}
                        </p>
                    )}
                </>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
                {!success && mission.kind === 'select' && (
                    <button type="button" onClick={checkSelection} className="rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-on-accent">
                        Vérifier ma sélection
                    </button>
                )}
                {!success && !hint && (
                    <button type="button" onClick={() => setHint(true)} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-warn/50">
                        Indice
                    </button>
                )}
                {index < missions.length - 1 && (
                    <button
                        type="button"
                        onClick={() => {
                            setIndex(index + 1);
                            setHint(false);
                            setFeedback(null);
                        }}
                        className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs hover:border-signal/50"
                    >
                        {success ? 'Mission suivante' : 'Passer'}
                    </button>
                )}
            </div>
        </section>
    );
}
