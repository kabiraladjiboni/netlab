import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PreferencesProvider } from '@/hooks/use-preferences';
import AdminLayout from '@/layouts/admin-layout';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';

// Le nom affiché vient des paramètres de la plateforme (props partagées), aussi lors du rendu serveur.
let brand = 'Abòrò Labs';
const appName = () => brand;

createInertiaApp({
    // Un titre qui contient déjà le nom (accueil, titres SEO complets) n'est pas suffixé.
    title: (title) => (!title ? appName() : title.includes(appName()) ? title : `${title} · ${appName()}`),
    serverHead: true,
    resolve: (name) => {
        const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx');
        const loader = pages[`./pages/${name}.tsx`];
        if (!loader) {
            throw new Error(`Page Inertia introuvable : ${name}`);
        }
        return loader().then((module) => module.default);
    },
    layout: (name: string) => (name.startsWith('admin/') ? AdminLayout : name.startsWith('auth/') ? AuthLayout : AppLayout),
    withApp(app, { page }) {
        const name = (page.props as { app?: { name?: string } }).app?.name;
        if (name) brand = name;
        return (
            <PreferencesProvider>
                <TooltipProvider delayDuration={150}>{app}</TooltipProvider>
            </PreferencesProvider>
        );
    },
    progress: { color: '#45d6c5', showSpinner: false },
});
