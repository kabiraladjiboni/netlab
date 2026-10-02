import { Link, router } from '@inertiajs/react';
import { BarChart3, ClipboardList, Gauge, Heart, History, LockKeyhole, LogOut, Settings, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/types/shared';

export const STUDENT_LINKS = [
    { href: '/app', label: 'Tableau de bord', icon: Gauge },
    { href: '/app/ma-progression', label: 'Ma progression', icon: ClipboardList },
    { href: '/app/mes-resultats', label: 'Mes résultats', icon: Trophy },
    { href: '/app/mes-favoris', label: 'Mes favoris', icon: Heart },
    { href: '/app/mon-historique', label: 'Mon historique', icon: History },
    { href: '/app/mon-profil', label: 'Mon profil', icon: UserRound },
    { href: '/app/securite', label: 'Sécurité', icon: LockKeyhole },
    { href: '/app/parametres', label: 'Paramètres', icon: Settings },
];

export function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

export function Avatar({ user, className }: { user: Pick<AuthUser, 'name'>; className?: string }) {
    return (
        <span className={cn('flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-signal to-[color-mix(in_oklab,var(--color-signal)_70%,var(--color-gold))] font-display text-sm font-semibold text-on-accent', className)} aria-hidden>
            {initials(user.name)}
        </span>
    );
}

export function UserMenu() {
    const user = useAuth();
    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-signal" aria-label={`Menu du compte de ${user.name}`}>
                <Avatar user={user} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>
                    <span className="block font-semibold">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.is_admin && (
                    <>
                        <DropdownMenuItem asChild>
                            <Link href="/admin">
                                <ShieldCheck /> Administration
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/admin/audience">
                                <BarChart3 /> Statistiques
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                {STUDENT_LINKS.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                        <Link href={link.href}>
                            <link.icon /> {link.label}
                        </Link>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.post('/deconnexion')}>
                    <LogOut /> Se déconnecter
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
