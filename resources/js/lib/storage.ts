import { useCallback, useSyncExternalStore } from 'react';

/**
 * Accès sûr au localStorage : la plateforme doit fonctionner même si le
 * stockage est indisponible (navigation privée, stockage bloqué…).
 */
export function readStorage<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
        return fallback;
    }
}

const EVENT = 'netlab:storage';

export function writeStorage<T>(key: string, value: T): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* stockage indisponible : on garde la valeur en mémoire pour la session */
        memory.set(key, value);
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

const memory = new Map<string, unknown>();

/**
 * Valeur persistée compatible avec le rendu serveur : `fallback` pendant le rendu
 * serveur et l'hydratation, puis la valeur enregistrée dans le navigateur.
 * Réservé aux valeurs simples (nombre, booléen, chaîne).
 */
export function useStoredValue<T extends string | number | boolean | null>(key: string, fallback: T, serverFallback: T = fallback): [T, (value: T) => void] {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const onCustom = (event: Event) => {
                if ((event as CustomEvent<string>).detail === key) onChange();
            };
            const onStorage = (event: StorageEvent) => {
                if (event.key === key) onChange();
            };
            window.addEventListener(EVENT, onCustom);
            window.addEventListener('storage', onStorage);
            return () => {
                window.removeEventListener(EVENT, onCustom);
                window.removeEventListener('storage', onStorage);
            };
        },
        [key],
    );
    const value = useSyncExternalStore(
        subscribe,
        () => (memory.has(key) ? (memory.get(key) as T) : readStorage<T>(key, fallback)),
        () => serverFallback,
    );
    const set = useCallback((next: T) => writeStorage(key, next), [key]);
    return [value, set];
}
