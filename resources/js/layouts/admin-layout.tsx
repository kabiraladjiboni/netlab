import { Link, router, usePage } from '@inertiajs/react';
import { BarChart3, BookOpenText, ClipboardCheck, FileClock, Gauge, GraduationCap, Library, LogOut, Menu, MessageSquareWarning, Network, Settings, Stethoscope, ThumbsUp, Users, Waypoints, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AssistantProvider } from '@/components/assistant/assistant-provider';
import { ToastProvider } from '@/components/layout/flash-toaster';
import { usePreferences } from '@/hooks/use-preferences';
import { BrandName, Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar } from '@/components/layout/user-menu';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types/shared';

const GROUPS = [
    {
        title: 'Pilotage',
        items: [
            { href: '/admin', label: 'Tableau de bord', icon: Gauge, exact: true },
            { href: '/admin/audience', label: 'Audience', icon: BarChart3 },
            { href: '/admin/apprentissage', label: 'Apprentissage', icon: GraduationCap },
        ],
    },
    {
        title: 'Contenus',
        items: [
            { href: '/admin/cours', label: 'Cours et chapitres', icon: Library, also: ['/admin/chapitres'] },
            { href: '/admin/protocoles', label: 'Protocoles', icon: Waypoints },
            { href: '/admin/glossaire', label: 'Glossaire', icon: BookOpenText },
            { href: '/admin/scenarios', label: 'Scénarios animés', icon: Network },
            { href: '/admin/quiz', label: 'Quiz', icon: ClipboardCheck },
            { href: '/admin/diagnostics', label: 'Diagnostics', icon: Stethoscope },
        ],
    },
    {
        title: 'Communauté',
        items: [
            { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
            { href: '/admin/retours', label: 'Retours', icon: MessageSquareWarning },
            { href: '/admin/evaluations', label: 'Favoris et évaluations', icon: ThumbsUp },
        ],
    },
    {
        title: 'Système',
        items: [
            { href: '/admin/journal', label: 'Journal', icon: FileClock },
            { href: '/admin/parametres', label: 'Paramètres', icon: Settings },
        ],
    },
];

function active(url: string, item: { href: string; exact?: boolean; also?: string[] }) {
    const path = url.split('?')[0];
    if (item.exact) return path === item.href;
    return [item.href, ...(item.also ?? [])].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { url, props } = usePage<SharedProps>();
    const user = useAuth();
    const [open, setOpen] = useState(false);
    const { level } = usePreferences();
    useEffect(() => setOpen(false), [url]);

    const nav = (
        <nav aria-label="Administration" className="space-y-5 p-3">
            {GROUPS.map((group) => (
                <div key={group.title}>
                    <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{group.title}</p>
                    <ul className="space-y-0.5">
                        {group.items.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    aria-current={active(url, item) ? 'page' : undefined}
                                    className={cn(
                                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-night-800 hover:text-foreground',
                                        active(url, item) && 'bg-night-700 font-medium text-foreground',
                                    )}
                                >
                                    <item.icon className={cn('size-4', active(url, item) && 'text-signal')} aria-hidden />
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );

    return (
        <ToastProvider>
          <AssistantProvider level={level}>
            <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
                <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line/60 bg-night-850 lg:flex">
                    <Link href="/admin" className="flex h-16 items-center gap-2.5 border-b border-line/60 px-5">
                        <Logo />
                        <span className="leading-tight">
                            <BrandName name={props.app.name} className="block text-sm" />
                            <span className="block text-[11px] text-muted-foreground">Administration</span>
                        </span>
                    </Link>
                    <div className="flex-1 overflow-y-auto scrollbar-thin">{nav}</div>
                    <div className="border-t border-line/60 p-3">
                        <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-night-800 hover:text-foreground">
                            ← Retour au site
                        </Link>
                    </div>
                </aside>

                {open && (
                    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu d’administration">
                        <button type="button" className="absolute inset-0 bg-overlay" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
                        <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-night-850 shadow-2xl scrollbar-thin">
                            <div className="flex h-16 items-center justify-between border-b border-line/60 px-4">
                                <span className="font-display font-semibold">Administration</span>
                                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer">
                                    <X className="size-5" aria-hidden />
                                </button>
                            </div>
                            {nav}
                            <Link href="/" className="m-3 block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-night-800">
                                ← Retour au site
                            </Link>
                        </div>
                    </div>
                )}

                <div className="min-w-0">
                    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/60 bg-night-900/85 px-4 backdrop-blur-xl sm:px-6">
                        <button type="button" onClick={() => setOpen(true)} className="flex size-9 items-center justify-center rounded-xl border border-line lg:hidden" aria-label="Ouvrir le menu">
                            <Menu className="size-5" aria-hidden />
                        </button>
                        {props.app.environment !== 'production' && (
                            <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs font-medium text-warn">Environnement : {props.app.environment}</span>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                            <ThemeToggle />
                            {user && (
                                <div className="flex items-center gap-2.5">
                                    <span className="hidden text-right text-sm leading-tight sm:block">
                                        <span className="block font-medium">{user.name}</span>
                                        <span className="block text-xs text-muted-foreground">Administrateur</span>
                                    </span>
                                    <Avatar user={user} />
                                </div>
                            )}
                            <button type="button" onClick={() => router.post('/deconnexion')} className="flex size-9 items-center justify-center rounded-xl border border-line text-muted-foreground hover:text-foreground" aria-label="Se déconnecter" title="Se déconnecter">
                                <LogOut className="size-4" aria-hidden />
                            </button>
                        </div>
                    </header>
                    <main id="contenu" className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:py-8">
                        {children}
                    </main>
                </div>
            </div>
          </AssistantProvider>
        </ToastProvider>
    );
}
