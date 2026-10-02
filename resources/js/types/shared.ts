import type { PageProps } from '@inertiajs/core';

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    role: 'student' | 'admin';
    is_admin: boolean;
    verified: boolean;
    country: string | null;
    preferences: { level?: 1 | 2 | 3; theme?: 'system' | 'light' | 'dark'; reduce_motion?: boolean } | null;
    two_factor?: boolean;
};

export type SharedProps = PageProps & {
    app: {
        name: string;
        tagline: string;
        slogan: string;
        community: string;
        community_motto: string;
        logo_url: string | null;
        ai_enabled: boolean;
        assistant_enabled: boolean;
        registration_open: boolean;
        lab_requires_verification: boolean;
        terms_url: string;
        privacy_url: string;
        contact_email: string | null;
        environment: string;
    };
    auth: { user: AuthUser | null };
    flash: { success: string | null; error: string | null };
    consent: 'granted' | 'denied' | null;
};
