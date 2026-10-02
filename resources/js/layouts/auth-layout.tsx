import { Link, usePage } from '@inertiajs/react';
import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/layout/flash-toaster';
import { BrandName, Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import type { SharedProps } from '@/types/shared';

const PROMISES = ['Gratuit, sans publicité', 'Ta progression sauvegardée sur tous tes appareils', 'Les TP interactifs paquet par paquet', 'Tes résultats de quiz et de diagnostics'];

export default function AuthLayout({ children }: { children: ReactNode }) {
    const { app } = usePage<SharedProps>().props;
    return (
        <ToastProvider>
            <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
                <aside className="relative hidden overflow-hidden border-r border-line/60 bg-night-850 lg:block">
                    <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
                    <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
                        <Link href="/" className="flex items-center gap-2.5">
                            <Logo />
                            <BrandName name={app.name} className="text-lg" />
                        </Link>
                        <div className="max-w-md">
                            <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-gold uppercase">{app.slogan}</p>
                            <h2 className="font-display text-3xl leading-tight font-semibold xl:text-4xl">
                                Comprends ce qui se passe <span className="text-gradient">derrière chaque clic.</span>
                            </h2>
                            <ul className="mt-8 space-y-3">
                                {PROMISES.map((item) => (
                                    <li key={item} className="flex items-center gap-3 text-[15px]">
                                        <CircleCheck className="size-5 shrink-0 text-ok" aria-hidden /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <p className="text-sm text-muted-foreground">Les cours restent accessibles sans compte. Le compte sert à manipuler les TP et à conserver ta progression.</p>
                    </div>
                </aside>
                <main id="contenu" className="flex flex-col px-4 py-6 sm:px-8">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 lg:invisible">
                            <Logo />
                            <BrandName name={app.name} />
                        </Link>
                        <ThemeToggle />
                    </div>
                    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
                    <p className="text-center text-xs text-muted-foreground">
                        <Link href={app.privacy_url} className="hover:text-foreground">
                            Confidentialité
                        </Link>
                        {' · '}
                        <Link href={app.terms_url} className="hover:text-foreground">
                            Conditions d’utilisation
                        </Link>
                    </p>
                </main>
            </div>
        </ToastProvider>
    );
}

export function IntendedNotice({ intended }: { intended: string | null }) {
    if (!intended) return null;
    return (
        <p className="mb-5 rounded-xl border border-signal/30 bg-signal/10 px-3 py-2.5 text-sm">
            Après la connexion, tu reprendras directement <strong>ton TP</strong> là où tu voulais aller.
        </p>
    );
}
