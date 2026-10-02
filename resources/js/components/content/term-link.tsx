import { Link } from '@inertiajs/react';
import { BookOpen, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePreferences } from '@/hooks/use-preferences';
import { getJson } from '@/lib/api';
import type { TermDetail } from '@/types/content';

const cache = new Map<string, Promise<TermDetail>>();

export function fetchTerm(slug: string): Promise<TermDetail> {
    let pending = cache.get(slug);
    if (!pending) {
        pending = getJson<TermDetail>(`/api/termes/${encodeURIComponent(slug)}`);
        pending.catch(() => cache.delete(slug));
        cache.set(slug, pending);
    }
    return pending;
}

/** Terme technique cliquable : affiche une explication contextuelle. */
export function TermLink({ slug, label }: { slug: string; label: string }) {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState<TermDetail | null>(null);
    const [failed, setFailed] = useState(false);
    const { level } = usePreferences();

    useEffect(() => {
        if (!open || term) return;
        let active = true;
        fetchTerm(slug)
            .then((data) => active && setTerm(data))
            .catch(() => active && setFailed(true));
        return () => {
            active = false;
        };
    }, [open, slug, term]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline cursor-help rounded-sm border-b border-dashed border-signal/70 font-medium text-signal decoration-signal/60 underline-offset-2 hover:border-solid hover:text-foreground"
                    aria-label={`${label} : afficher la définition`}
                >
                    {label}
                </button>
            </PopoverTrigger>
            <PopoverContent>
                {failed && <p className="text-sm text-muted-foreground">Définition indisponible pour le moment.</p>}
                {!failed && !term && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement de la définition…
                    </p>
                )}
                {term && (
                    <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                            <p className="font-display text-base font-semibold">{term.term}</p>
                            {term.category && <span className="rounded-full bg-night-700 px-2 py-0.5 text-[11px] text-muted-foreground">{term.category}</span>}
                        </div>
                        <p className="text-sm leading-relaxed">{term.simple}</p>
                        {level >= 2 && (
                            <p className="rounded-lg border border-line bg-night-900/60 p-2.5 text-[13px] leading-relaxed text-muted-foreground">
                                <span className="mb-1 block text-[11px] font-semibold tracking-wide text-signal uppercase">Définition technique</span>
                                {term.technical}
                            </p>
                        )}
                        {term.example && <p className="text-[13px] text-muted-foreground">Exemple : {term.example}</p>}
                        <Link href={`/dictionnaire/${term.slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-signal hover:underline">
                            <BookOpen className="size-3.5" aria-hidden /> Ouvrir dans le dictionnaire
                        </Link>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
