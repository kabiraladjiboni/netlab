import { Link, router, usePage } from '@inertiajs/react';
import { BookOpen, Compass, FlaskConical, Layers, LogIn, LogOut, Menu, MessageCircleQuestion, Network, Radar, Search, ShieldCheck, Sparkles, UserPlus, Waypoints, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AssistantProvider, useAssistant } from '@/components/assistant/assistant-provider';
import { ConsentBanner } from '@/components/layout/consent-banner';
import { DisplayPreferences, PreferencesFields } from '@/components/layout/display-preferences';
import { ToastProvider } from '@/components/layout/flash-toaster';
import { BrandName, Logo } from '@/components/layout/logo';
import { SearchDialog } from '@/components/layout/search-dialog';
import { Avatar, STUDENT_LINKS, UserMenu } from '@/components/layout/user-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { usePreferences } from '@/hooks/use-preferences';
import { usePresence } from '@/hooks/use-presence';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types/shared';

export const NAV = [
    { href: '/apprendre', label: 'Cours', icon: Compass, match: ['/apprendre', '/cours', '/lecons', '/quiz'] },
    { href: '/laboratoire', label: 'Laboratoire', icon: FlaskConical, match: ['/laboratoire', '/diagnostic'] },
    { href: '/protocoles', label: 'Protocoles', icon: Waypoints, match: ['/protocoles'] },
    { href: '/modeles/osi', label: 'Modèles', icon: Layers, match: ['/modeles'] },
    { href: '/reseaux', label: 'Réseaux', icon: Network, match: ['/reseaux', '/equipements', '/segmentation'] },
    { href: '/wireshark', label: 'Wireshark', icon: Radar, match: ['/wireshark'] },
    { href: '/dictionnaire', label: 'Dictionnaire', icon: BookOpen, match: ['/dictionnaire'] },
];

export function isActive(url: string, match: string[]) {
    const path = url.split('?')[0];
    return match.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export default function AppLayout({ children }: { children: ReactNode }) {
    const { level } = usePreferences();
    return (
        <ToastProvider>
            <AssistantProvider level={level}>
                <Shell>{children}</Shell>
            </AssistantProvider>
        </ToastProvider>
    );
}

function Shell({ children }: { children: ReactNode }) {
    const page = usePage<SharedProps>();
    const { url } = page;
    const { app, consent } = page.props;
    const user = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const assistant = useAssistant();
    const assistantOn = app.assistant_enabled;

    usePresence(user !== null || consent === 'granted');
    useAccountPreferences();

    useEffect(() => setMenuOpen(false), [url]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSearchOpen(true);
            }
            const target = event.target as HTMLElement | null;
            if (event.key === '/' && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !target?.isContentEditable) {
                event.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const redirect = encodeURIComponent(url);

    return (
        <div className="flex min-h-dvh flex-col">
            <a href="#contenu" className="sr-only z-[60] rounded-lg bg-signal px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
                Aller au contenu
            </a>
            <header className="sticky top-0 z-40 border-b border-line/60 bg-night-900/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
                    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label={`${app.name} — accueil`}>
                        <Logo />
                        <BrandName name={app.name} className="text-[17px]" />
                    </Link>

                    <nav aria-label="Navigation principale" className="ml-3 hidden items-center gap-0.5 xl:flex">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive(url, item.match) ? 'page' : undefined}
                                className={cn(
                                    'rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-night-800 hover:text-foreground 2xl:px-3',
                                    isActive(url, item.match) && 'bg-night-800 text-foreground',
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setSearchOpen(true)}
                            className="flex size-9 items-center justify-center gap-2 rounded-xl border border-line bg-night-850/80 text-sm text-muted-foreground transition-colors hover:border-signal/50 hover:text-foreground md:w-48 md:justify-start md:px-3 xl:w-9 xl:justify-center xl:px-0 2xl:w-48 2xl:justify-start 2xl:px-3"
                            aria-label="Rechercher (Ctrl+K)"
                        >
                            <Search className="size-4" aria-hidden />
                            <span className="hidden md:inline xl:hidden 2xl:inline">Rechercher…</span>
                            <kbd className="kbd ml-auto hidden md:inline-flex xl:hidden 2xl:inline-flex">/</kbd>
                        </button>
                        <DisplayPreferences className="hidden sm:flex" />
                        {assistantOn && (
                            <button
                                type="button"
                                onClick={() => assistant.open()}
                                className="hidden h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-signal to-signal px-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110 sm:flex 2xl:px-3"
                                aria-label="Ouvrir l’assistant"
                            >
                                <Sparkles className="size-4" aria-hidden />
                                <span className="hidden lg:inline xl:hidden 2xl:inline">Assistant</span>
                            </button>
                        )}
                        {user ? (
                            <div className="hidden sm:block">
                                <UserMenu />
                            </div>
                        ) : (
                            <div className="hidden items-center gap-1.5 sm:flex">
                                <Link href={`/connexion?redirect=${redirect}`} className="flex h-9 items-center rounded-xl px-3 text-sm font-medium hover:bg-night-800">
                                    Connexion
                                </Link>
                                <Link href={`/inscription?redirect=${redirect}`} className="hidden h-9 items-center rounded-xl border border-signal/50 px-3 text-sm font-semibold text-signal hover:bg-signal/10 lg:flex xl:hidden 2xl:flex">
                                    Créer un compte
                                </Link>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setMenuOpen(true)}
                            className="flex size-9 items-center justify-center rounded-xl border border-line xl:hidden"
                            aria-label="Ouvrir le menu"
                            aria-expanded={menuOpen}
                        >
                            <Menu className="size-5" aria-hidden />
                        </button>
                    </div>
                </div>
            </header>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetContent side="right" className="w-[88vw] max-w-sm gap-0 overflow-y-auto p-0 scrollbar-thin">
                    <div className="flex items-center justify-between border-b border-line px-5 py-4">
                        <SheetTitle className="font-display">Menu</SheetTitle>
                        <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg p-1" aria-label="Fermer le menu">
                            <X className="size-5" aria-hidden />
                        </button>
                    </div>
                    {user ? (
                        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                            <Avatar user={user} />
                            <div className="min-w-0">
                                <p className="truncate font-semibold">{user.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 border-b border-line p-4">
                            <Link href={`/connexion?redirect=${redirect}`} className="flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-medium">
                                <LogIn className="size-4" aria-hidden /> Connexion
                            </Link>
                            <Link href={`/inscription?redirect=${redirect}`} className="flex items-center justify-center gap-2 rounded-xl bg-signal px-3 py-2.5 text-sm font-semibold text-on-accent">
                                <UserPlus className="size-4" aria-hidden /> S’inscrire
                            </Link>
                        </div>
                    )}
                    <nav aria-label="Navigation mobile" className="flex flex-col gap-0.5 p-3">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive(url, item.match) ? 'page' : undefined}
                                className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-night-800', isActive(url, item.match) && 'bg-night-800 text-signal')}
                            >
                                <item.icon className="size-5 text-signal" aria-hidden /> {item.label}
                            </Link>
                        ))}
                    </nav>
                    {user && (
                        <nav aria-label="Mon espace" className="flex flex-col gap-0.5 border-t border-line p-3">
                            <p className="px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mon espace</p>
                            {user.is_admin && (
                                <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-night-800">
                                    <ShieldCheck className="size-4 text-warn" aria-hidden /> Administration
                                </Link>
                            )}
                            {STUDENT_LINKS.map((link) => (
                                <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-night-800">
                                    <link.icon className="size-4 text-muted-foreground" aria-hidden /> {link.label}
                                </Link>
                            ))}
                            <button type="button" onClick={() => router.post('/deconnexion')} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-night-800">
                                <LogOut className="size-4 text-muted-foreground" aria-hidden /> Se déconnecter
                            </button>
                        </nav>
                    )}
                    <div className="space-y-4 border-t border-line p-5">
                        <PreferencesFields />
                        {assistantOn && (
                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
                                    assistant.open();
                                }}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent"
                            >
                                <MessageCircleQuestion className="size-4" aria-hidden /> Poser une question
                            </button>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

            <main id="contenu" className="flex-1">
                {children}
            </main>

            <SiteFooter />
            <ConsentBanner />
        </div>
    );
}

/** Applique une fois par session les préférences enregistrées dans le compte (multi-appareils). */
function useAccountPreferences() {
    const user = useAuth();
    const { setLevel, setTheme, setReduceMotion } = usePreferences();
    useEffect(() => {
        if (!user?.preferences) return;
        const key = `netlab.prefsApplied.${user.id}`;
        try {
            if (window.sessionStorage.getItem(key)) return;
            window.sessionStorage.setItem(key, '1');
        } catch {
            return;
        }
        const prefs = user.preferences;
        if (prefs.level) setLevel(prefs.level);
        if (prefs.theme) setTheme(prefs.theme);
        if (prefs.reduce_motion !== undefined) setReduceMotion(prefs.reduce_motion);
    }, [user, setLevel, setTheme, setReduceMotion]);
}

const FOOTER_COLUMNS: { title: string; links: [string, string][] }[] = [
    {
        title: 'Apprendre',
        links: [
            ['/apprendre', 'Parcours et cours'],
            ['/lecons/acces-internet', 'Comment fonctionne Internet'],
            ['/modeles/osi', 'Modèle OSI'],
            ['/modeles/tcp-ip', 'Modèle TCP/IP'],
            ['/protocoles', 'Catalogue des protocoles'],
            ['/reseaux', 'Types de réseaux'],
        ],
    },
    {
        title: 'Pratiquer',
        links: [
            ['/laboratoire', 'Laboratoire de TP'],
            ['/diagnostic', 'Exercices de diagnostic'],
            ['/quiz', 'Quiz'],
            ['/wireshark', 'Lire une capture Wireshark'],
            ['/dictionnaire', 'Dictionnaire des réseaux'],
        ],
    },
];

function SiteFooter() {
    const { app } = usePage<SharedProps>().props;
    const user = useAuth();
    const year = new Date().getFullYear();
    const about: [string, string][] = [
        ['/notre-histoire', 'Notre histoire'],
        user ? ['/app', 'Mon espace'] : ['/inscription', 'Créer un compte gratuit'],
        ...(app.contact_email ? ([[`mailto:${app.contact_email}`, 'Nous écrire']] as [string, string][]) : []),
        [app.privacy_url, 'Confidentialité'],
        [app.terms_url, 'Conditions d’utilisation'],
    ];

    return (
        <footer className="mt-20 border-t border-line/60 bg-night-950/40" aria-labelledby="footer-title">
            <h2 id="footer-title" className="sr-only">
                À propos de {app.name}
            </h2>
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
                    <div className="col-span-2 max-w-md space-y-4 lg:col-span-1">
                        <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg" aria-label={`${app.name} — accueil`}>
                            <Logo className="size-9" />
                            <BrandName name={app.name} className="text-lg" />
                        </Link>
                        <p className="text-[15px] leading-relaxed text-muted-foreground">
                            <strong className="font-semibold text-foreground">{app.name}</strong> est une plateforme pour apprendre les réseaux informatiques en français. Des animations pas à pas montrent comment circulent les paquets (DNS, TCP, TLS, DHCP, NAT…), et des travaux pratiques virtuels permettent de s’exercer, du modèle OSI jusqu’à la lecture d’une capture Wireshark.
                        </p>
                        <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold">
                            <span className="size-1.5 rounded-full bg-gold" aria-hidden />
                            {app.community_motto}
                        </p>
                    </div>
                    {FOOTER_COLUMNS.map((column) => (
                        <FooterColumn key={column.title} title={column.title} links={column.links} />
                    ))}
                    <FooterColumn title="La plateforme" links={about} />
                </div>
                <div className="flex flex-col gap-3 border-t border-line/60 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <p>
                        © {year} {app.name} · <span className="font-display text-foreground/80">{app.slogan}</span>
                    </p>
                    <p className="max-w-xl md:text-right">
                        Les animations sont des scénarios pédagogiques construits pour être exacts et lisibles : ce ne sont ni des captures ni des simulations d’un vrai réseau.
                    </p>
                </div>
            </div>
        </footer>
    );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
    return (
        <nav aria-label={title}>
            <h3 className="mb-4 text-xs font-semibold tracking-[0.14em] text-foreground uppercase">{title}</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
                {links.map(([href, label]) => (
                    <li key={href}>
                        {href.startsWith('/') ? (
                            <Link className="transition-colors hover:text-signal" href={href}>
                                {label}
                            </Link>
                        ) : (
                            <a className="transition-colors hover:text-signal" href={href} rel="noopener noreferrer">
                                {label}
                            </a>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}
