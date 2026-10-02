import { useEffect, useRef } from 'react';

type Handlers = Partial<Record<'space' | 'left' | 'right' | 'r', () => void>>;

function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Raccourcis clavier du lecteur d'animation. Ignorés pendant la saisie et
 * lorsqu'une fenêtre modale est ouverte.
 */
export function usePlayerShortcuts(handlers: Handlers, enabled = true) {
    const ref = useRef(handlers);
    ref.current = handlers;

    useEffect(() => {
        if (!enabled) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
            if (isTyping(event.target)) return;
            if (document.querySelector('[role="dialog"][data-state="open"]')) return;
            const target = event.target as HTMLElement | null;
            const onButton = target?.closest('button, a, [role="button"], [role="tab"]');
            let handler: (() => void) | undefined;
            if (event.key === ' ' && !onButton) handler = ref.current.space;
            else if (event.key === 'ArrowLeft' && !target?.closest('[role="tablist"]')) handler = ref.current.left;
            else if (event.key === 'ArrowRight' && !target?.closest('[role="tablist"]')) handler = ref.current.right;
            else if (event.key.toLowerCase() === 'r') handler = ref.current.r;
            if (handler) {
                event.preventDefault();
                handler();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enabled]);
}
