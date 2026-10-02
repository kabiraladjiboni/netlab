import { useCallback, useSyncExternalStore } from 'react';

/**
 * Media query compatible avec le rendu serveur : pendant le rendu serveur et
 * l'hydratation, `serverValue` est utilisé (même HTML des deux côtés), puis la
 * vraie valeur du navigateur prend le relais.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
            const list = window.matchMedia(query);
            list.addEventListener?.('change', onChange);
            return () => list.removeEventListener?.('change', onChange);
        },
        [query],
    );
    return useSyncExternalStore(
        subscribe,
        () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : serverValue),
        () => serverValue,
    );
}
