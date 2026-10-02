import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useStoredValue } from '@/lib/storage';

/** 1 = Je découvre, 2 = Je comprends, 3 = J'approfondis */
export type Level = 1 | 2 | 3;

export const LEVELS: { value: Level; label: string; short: string; description: string }[] = [
    { value: 1, label: 'Je découvre', short: 'Découvrir', description: 'Explications simples, très peu de jargon.' },
    { value: 2, label: 'Je comprends', short: 'Comprendre', description: 'Adresses, ports, rôle des protocoles.' },
    { value: 3, label: "J'approfondis", short: 'Approfondir', description: 'Champs, en-têtes, drapeaux, cas particuliers.' },
];

export type ThemeSetting = 'system' | 'light' | 'dark';

function useSystemDark(): boolean {
    return useMediaQuery('(prefers-color-scheme: dark)', true);
}

type Preferences = {
    /** Thème choisi (« system » suit le réglage de l'appareil). */
    theme: ThemeSetting;
    setTheme: (theme: ThemeSetting) => void;
    /** Thème effectivement affiché. */
    resolvedTheme: 'light' | 'dark';
    level: Level;
    setLevel: (level: Level) => void;
    /** Préférence manuelle de l'utilisateur. */
    reduceMotionSetting: boolean;
    setReduceMotion: (value: boolean) => void;
    /** Résultat effectif : préférence système OU préférence manuelle. */
    reducedMotion: boolean;
};

const PreferencesContext = createContext<Preferences | null>(null);

function useSystemReducedMotion(): boolean {
    return useMediaQuery('(prefers-reduced-motion: reduce)', false);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const [level, setLevelStored] = useStoredValue<Level>('netlab.level', 1);
    const [reduceMotionSetting, setReduceStored] = useStoredValue<boolean>('netlab.reduceMotion', false);
    const system = useSystemReducedMotion();
    // Le thème est enregistré en texte brut (lu aussi par le script anti-flash de app.blade.php).
    // Lu après le montage pour que le HTML rendu par le serveur et l'hydratation coïncident ;
    // en attendant, la classe posée par le script anti-flash reste en place.
    const [theme, setThemeState] = useState<ThemeSetting>('system');
    const [themeLoaded, setThemeLoaded] = useState(false);
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem('netlab.theme');
            if (stored === 'light' || stored === 'dark') setThemeState(stored);
        } catch {
            /* stockage indisponible */
        }
        setThemeLoaded(true);
    }, []);
    const systemDark = useSystemDark();
    const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

    const setTheme = useCallback((value: ThemeSetting) => {
        setThemeState(value);
        try {
            if (value === 'system') window.localStorage.removeItem('netlab.theme');
            else window.localStorage.setItem('netlab.theme', value);
        } catch {
            /* stockage indisponible : le choix vaut pour la session en cours */
        }
    }, []);

    useEffect(() => {
        if (!themeLoaded) return;
        const root = document.documentElement;
        root.classList.toggle('dark', resolvedTheme === 'dark');
        root.classList.toggle('light', resolvedTheme === 'light');
    }, [resolvedTheme, themeLoaded]);

    const setLevel = useCallback((value: Level) => setLevelStored(value), [setLevelStored]);
    const setReduceMotion = useCallback((value: boolean) => setReduceStored(value), [setReduceStored]);

    useEffect(() => {
        if (reduceMotionSetting) {
            document.documentElement.dataset.reduceMotion = 'true';
        } else {
            delete document.documentElement.dataset.reduceMotion;
        }
    }, [reduceMotionSetting]);

    const value = useMemo(
        () => ({ theme, setTheme, resolvedTheme, level, setLevel, reduceMotionSetting, setReduceMotion, reducedMotion: system || reduceMotionSetting }),
        [theme, setTheme, resolvedTheme, level, setLevel, reduceMotionSetting, setReduceMotion, system],
    );

    return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error('usePreferences doit être utilisé dans <PreferencesProvider>.');
    }
    return context;
}
