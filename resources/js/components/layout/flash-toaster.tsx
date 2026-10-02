import { router, usePage } from '@inertiajs/react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { SharedProps } from '@/types/shared';

type Toast = { id: number; kind: 'success' | 'error'; message: string };
type ToastApi = { notify: (message: string, kind?: Toast['kind']) => void };

const ToastContext = createContext<ToastApi>({ notify: () => undefined });

/** Retour visuel après chaque action (messages « flash » du serveur et notifications locales). */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counter = useRef(0);
    const { flash } = usePage<SharedProps>().props;

    const notify = useCallback((message: string, kind: Toast['kind'] = 'success') => {
        counter.current += 1;
        const id = counter.current;
        setToasts((items) => [...items.slice(-2), { id, kind, message }]);
        window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), kind === 'error' ? 8000 : 4500);
    }, []);

    // Les messages flash arrivent avec la réponse Inertia qui suit une action.
    useEffect(() => {
        return router.on('success', (event) => {
            const props = (event.detail.page.props as unknown as SharedProps).flash;
            if (props?.success) notify(props.success, 'success');
            if (props?.error) notify(props.error, 'error');
        });
    }, [notify]);

    // Premier affichage (ex. redirection après connexion).
    const first = useRef(true);
    useEffect(() => {
        if (!first.current) return;
        first.current = false;
        if (flash?.success) notify(flash.success, 'success');
        if (flash?.error) notify(flash.error, 'error');
    }, [flash, notify]);

    return (
        <ToastContext.Provider value={{ notify }}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite" role="status">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-popover px-4 py-3 text-sm shadow-xl shadow-[var(--shadow-color)]"
                        >
                            {toast.kind === 'success' ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
                            <p className="flex-1 leading-snug">{toast.message}</p>
                            <button type="button" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} className="text-muted-foreground hover:text-foreground" aria-label="Fermer la notification">
                                <X className="size-4" aria-hidden />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastApi {
    return useContext(ToastContext);
}
