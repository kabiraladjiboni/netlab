import { useEffect } from 'react';
import { sendJson } from '@/lib/api';

/**
 * Signal de présence : envoyé toutes les 60 s uniquement si l'onglet est
 * visible ET qu'une interaction a eu lieu dans les 2 dernières minutes.
 * Un onglet oublié n'est donc pas compté comme « actif ».
 */
export function usePresence(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        let lastInteraction = Date.now();
        const mark = () => {
            lastInteraction = Date.now();
        };
        const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
        events.forEach((name) => window.addEventListener(name, mark, { passive: true }));
        const timer = window.setInterval(() => {
            if (document.visibilityState !== 'visible' || Date.now() - lastInteraction > 120_000) return;
            sendJson('POST', '/api/presence').catch(() => undefined);
        }, 60_000);
        return () => {
            window.clearInterval(timer);
            events.forEach((name) => window.removeEventListener(name, mark));
        };
    }, [enabled]);
}
