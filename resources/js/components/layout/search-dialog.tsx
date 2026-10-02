import { router } from '@inertiajs/react';
import { BookOpen, Compass, CornerDownLeft, Cpu, Layers, Loader2, Network, Search, Waypoints } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getJson } from '@/lib/api';
import { cn } from '@/lib/utils';

export type SearchResult = {
    type: 'protocol' | 'term' | 'layer' | 'lesson' | 'network' | 'equipment' | 'page';
    title: string;
    subtitle: string;
    href: string;
};

const groups: Record<SearchResult['type'], { label: string; icon: typeof Search }> = {
    lesson: { label: 'Leçons et parcours', icon: Compass },
    protocol: { label: 'Protocoles', icon: Waypoints },
    layer: { label: 'Couches OSI / TCP-IP', icon: Layers },
    term: { label: 'Dictionnaire', icon: BookOpen },
    network: { label: 'Types de réseaux', icon: Network },
    equipment: { label: 'Équipements', icon: Cpu },
    page: { label: 'Pages', icon: Compass },
};

const SUGGESTIONS = ['TCP', 'NAT', 'DNS', 'couche transport', 'VLAN', 'adresse MAC', 'QUIC', 'routeur'];

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    const [error, setError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const term = query.trim();
        if (term.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        setLoading(true);
        const timer = window.setTimeout(() => {
            getJson<{ results: SearchResult[] }>(`/api/recherche?q=${encodeURIComponent(term)}`, controller.signal)
                .then((data) => {
                    setResults(data.results);
                    setActive(0);
                    setError(false);
                })
                .catch((reason: Error) => {
                    if (reason.name !== 'AbortError') setError(true);
                })
                .finally(() => setLoading(false));
        }, 160);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query, open]);

    const grouped = useMemo(() => {
        const order: SearchResult['type'][] = ['lesson', 'protocol', 'layer', 'term', 'network', 'equipment', 'page'];
        return order
            .map((type) => ({ type, items: results.filter((result) => result.type === type) }))
            .filter((group) => group.items.length > 0);
    }, [results]);

    const flat = grouped.flatMap((group) => group.items);

    const go = (result: SearchResult) => {
        onOpenChange(false);
        setQuery('');
        router.visit(result.href);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden border-line bg-night-850 p-0 sm:max-w-xl" aria-describedby={undefined}>
                <DialogTitle className="sr-only">Recherche globale</DialogTitle>
                <div className="flex items-center gap-3 border-b border-line px-4">
                    <Search className="size-5 shrink-0 text-signal" aria-hidden />
                    <input
                        ref={inputRef}
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                setActive((value) => Math.min(flat.length - 1, value + 1));
                            } else if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                setActive((value) => Math.max(0, value - 1));
                            } else if (event.key === 'Enter' && flat[active]) {
                                event.preventDefault();
                                go(flat[active]);
                            }
                        }}
                        placeholder="Protocole, concept, couche, équipement, terme…"
                        className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
                        aria-label="Rechercher"
                        role="combobox"
                        aria-expanded={flat.length > 0}
                        aria-controls="search-results"
                        aria-activedescendant={flat[active] ? `search-${active}` : undefined}
                    />
                    {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
                </div>
                <div id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
                    {query.trim().length < 2 && (
                        <div className="p-3">
                            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Suggestions</p>
                            <div className="flex flex-wrap gap-2">
                                {SUGGESTIONS.map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => setQuery(suggestion)}
                                        className="rounded-full border border-line px-3 py-1 text-sm hover:border-signal/60 hover:text-signal"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {error && <p className="p-4 text-sm text-danger">La recherche est momentanément indisponible.</p>}
                    {!loading && !error && query.trim().length >= 2 && flat.length === 0 && (
                        <p className="p-4 text-sm text-muted-foreground">Aucun résultat pour « {query} ». Essaie un sigle (TCP, DNS…) ou un mot plus simple.</p>
                    )}
                    {grouped.map((group) => {
                        const Icon = groups[group.type].icon;
                        return (
                            <div key={group.type} className="mb-2">
                                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{groups[group.type].label}</p>
                                {group.items.map((result) => {
                                    const index = flat.indexOf(result);
                                    return (
                                        <button
                                            key={result.href}
                                            id={`search-${index}`}
                                            type="button"
                                            role="option"
                                            aria-selected={index === active}
                                            onMouseEnter={() => setActive(index)}
                                            onClick={() => go(result)}
                                            className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', index === active && 'bg-night-700')}
                                        >
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-night-800 text-signal">
                                                <Icon className="size-4" aria-hidden />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{result.title}</span>
                                                <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                                            </span>
                                            {index === active && <CornerDownLeft className="size-4 text-muted-foreground" aria-hidden />}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}
