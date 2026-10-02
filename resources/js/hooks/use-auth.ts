import { usePage } from '@inertiajs/react';
import type { AuthUser, SharedProps } from '@/types/shared';

export function useAuth(): AuthUser | null {
    return usePage<SharedProps>().props.auth?.user ?? null;
}

export function useShared(): SharedProps {
    return usePage<SharedProps>().props;
}

/** Lien vers la connexion qui ramène ensuite à la page indiquée. */
export function loginHref(redirect?: string, register = false): string {
    const target = redirect ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
    return `${register ? '/inscription' : '/connexion'}?redirect=${encodeURIComponent(target)}`;
}

/** Accès aux TP, même règle que le serveur (le serveur reste seul juge). */
export function useLabAccess(): 'allowed' | 'guest' | 'unverified' {
    const { auth, app } = usePage<SharedProps>().props;
    if (!auth.user) return 'guest';
    if (app.lab_requires_verification && !auth.user.verified && !auth.user.is_admin) return 'unverified';
    return 'allowed';
}
