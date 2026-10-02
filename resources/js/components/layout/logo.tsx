import { cn } from '@/lib/utils';

/**
 * Symbole Abòrò Labs : la lettre A dessinée comme un petit réseau.
 * Un nœud au sommet, deux « amis » à la base, et un lien doré qui les réunit
 * au milieu (Abòrò : l'amitié, la convivialité, apprendre ensemble).
 * Le point clair est un paquet en chemin.
 */
export function Logo({ className = 'size-8' }: { className?: string }) {
    return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
            <rect width="48" height="48" rx="13" fill="#101D35" />
            <g strokeLinecap="round" fill="none">
                <path d="M24 9.5 L11 37.5 M24 9.5 L37 37.5" stroke="#45D6C5" strokeWidth="3" />
                <path d="M17.5 23.5 H30.5" stroke="#F3B75E" strokeWidth="3" />
            </g>
            <circle cx="24" cy="9.5" r="4.4" fill="#45D6C5" />
            <circle cx="11" cy="37.5" r="4.4" fill="#101D35" stroke="#45D6C5" strokeWidth="3" />
            <circle cx="37" cy="37.5" r="4.4" fill="#101D35" stroke="#45D6C5" strokeWidth="3" />
            <circle cx="17.5" cy="23.5" r="3.6" fill="#F3B75E" />
            <circle cx="30.5" cy="23.5" r="3.6" fill="#F3B75E" />
            <circle cx="14.3" cy="30.4" r="1.9" fill="#F4F7FB" />
        </svg>
    );
}

/** Nom de la marque : « Labs » en turquoise lorsque le nom se termine ainsi. */
export function BrandName({ name, className }: { name: string; className?: string }) {
    const match = name.match(/^(.*\S)\s+(Labs)$/);
    return (
        <span className={cn('font-display font-bold tracking-tight', className)}>
            {match ? (
                <>
                    {match[1]} <span className="font-medium text-signal">{match[2]}</span>
                </>
            ) : (
                name
            )}
        </span>
    );
}
