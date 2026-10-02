import { Link, usePage } from '@inertiajs/react';
import { MailWarning } from 'lucide-react';
import type { ReactNode } from 'react';
import { STUDENT_LINKS } from '@/components/layout/user-menu';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/** Cadre commun de l'espace étudiant : titre + navigation par onglets. */
export function StudentShell({ title, description, children, actions }: { title: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
    const { url } = usePage();
    const user = useAuth();
    const path = url.split('?')[0];
    return (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <nav aria-label="Mon espace" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin">
                {STUDENT_LINKS.map((link) => {
                    const active = link.href === '/app' ? path === '/app' : path.startsWith(link.href);
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn('inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-night-800 hover:text-foreground', active && 'bg-night-700 font-medium text-foreground')}
                        >
                            <link.icon className="size-4" aria-hidden /> {link.label}
                        </Link>
                    );
                })}
            </nav>
            {user && !user.verified && (
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
                    <MailWarning className="size-5 text-warn" aria-hidden />
                    <span className="flex-1">Confirme ton adresse e-mail pour accéder aux TP interactifs.</span>
                    <Link href="/email/verification" className="font-semibold text-signal hover:underline">
                        Renvoyer le lien
                    </Link>
                </div>
            )}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
                    {description && <p className="mt-1 text-muted-foreground">{description}</p>}
                </div>
                {actions}
            </div>
            {children}
        </div>
    );
}
