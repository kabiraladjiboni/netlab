import { useCallback, useEffect, useRef, useState } from 'react';
import { sendJson } from '@/lib/api';

export type LabSessionData = {
    id: number;
    lab_slug: string;
    variant: string | null;
    status: 'in_progress' | 'completed';
    current_step: number;
    total_steps: number;
    steps_seen: number[];
    progress: number;
    active_seconds: number;
    completed_at: string | null;
};

/**
 * Séance de TP côté serveur.
 * - démarre ou reprend la séance (une par variante) ;
 * - mémorise les étapes vues et n'envoie qu'une sauvegarde toutes les 4 s au plus,
 *   plus une dernière à la fermeture de la page (jamais une requête par image) ;
 * - le temps actif ne compte que si l'onglet est visible et qu'il y a eu une
 *   interaction ou une lecture récente.
 */
export function useLabSession(slug: string, variant: string | null, totalSteps: number, enabled: boolean) {
    const [session, setSession] = useState<LabSessionData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [justCompleted, setJustCompleted] = useState(false);
    const pending = useRef<{ current: number; seen: Set<number> } | null>(null);
    const activeAccumulator = useRef(0);
    const lastTick = useRef(Date.now());
    const lastInteraction = useRef(Date.now());
    const timer = useRef<number | null>(null);
    const sessionRef = useRef<LabSessionData | null>(null);
    sessionRef.current = session;

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        setSession(null);
        setJustCompleted(false);
        sendJson<{ session: LabSessionData }>('POST', `/api/labs/${slug}/sessions`, { variant, total_steps: totalSteps })
            .then((response) => !cancelled && setSession(response.session))
            .catch((caught: Error) => !cancelled && setError(caught.message));
        return () => {
            cancelled = true;
        };
    }, [slug, variant, totalSteps, enabled]);

    // Temps actif (onglet visible + interaction récente).
    useEffect(() => {
        if (!enabled) return;
        const mark = () => {
            lastInteraction.current = Date.now();
        };
        const events = ['pointerdown', 'keydown', 'scroll'] as const;
        events.forEach((name) => window.addEventListener(name, mark, { passive: true }));
        const interval = window.setInterval(() => {
            const now = Date.now();
            const delta = Math.round((now - lastTick.current) / 1000);
            lastTick.current = now;
            if (document.visibilityState === 'visible' && now - lastInteraction.current < 90_000) activeAccumulator.current += Math.min(delta, 15);
        }, 5000);
        return () => {
            window.clearInterval(interval);
            events.forEach((name) => window.removeEventListener(name, mark));
        };
    }, [enabled]);

    const flush = useCallback(async (keepalive = false) => {
        const current = sessionRef.current;
        const data = pending.current;
        if (!current || !data) return;
        pending.current = null;
        const delta = activeAccumulator.current;
        activeAccumulator.current = 0;
        try {
            const response = await sendJson<{ session: LabSessionData; just_completed: boolean }>(
                'PATCH',
                `/api/lab-sessions/${current.id}`,
                { current_step: data.current, steps_seen: [...data.seen], active_delta: delta },
                { keepalive },
            );
            if (!keepalive) {
                setSession(response.session);
                if (response.just_completed) setJustCompleted(true);
            }
        } catch {
            // Échec réseau : on remet les étapes en attente pour la prochaine tentative.
            const later = pending.current as { current: number; seen: Set<number> } | null;
            pending.current = { current: later?.current ?? data.current, seen: new Set([...(later?.seen ?? []), ...data.seen]) };
            activeAccumulator.current += delta;
        }
    }, []);

    const recordStep = useCallback(
        (index: number) => {
            if (!enabled) return;
            lastInteraction.current = Date.now();
            const seen = pending.current?.seen ?? new Set<number>();
            seen.add(index);
            pending.current = { current: index, seen };
            const isLast = index === totalSteps - 1;
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => void flush(), isLast ? 300 : 4000);
        },
        [enabled, flush, totalSteps],
    );

    // Dernière sauvegarde en quittant la page ou en changeant d'onglet.
    useEffect(() => {
        if (!enabled) return;
        const onHide = () => {
            if (document.visibilityState === 'hidden') void flush(true);
        };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onHide);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onHide);
            if (timer.current) window.clearTimeout(timer.current);
            void flush(true);
        };
    }, [enabled, flush]);

    return { session, error, recordStep, justCompleted, dismissCompleted: () => setJustCompleted(false) };
}
