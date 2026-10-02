import { Link, router } from '@inertiajs/react';
import { BookOpen, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/content/page-header';
import { cn, normalize } from '@/lib/utils';
import type { TermDetail } from '@/types/content';

type TermItem = { slug: string; term: string; aliases: string[]; category: string | null; simple: string };

export default function Glossary({ terms, selected }: { terms: TermItem[]; selected: TermDetail | null }) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string | null>(null);
    const detailRef = useRef<HTMLElement>(null);
    const categories = useMemo(() => Array.from(new Set(terms.map((t) => t.category).filter(Boolean))) as string[], [terms]);

    const filtered = useMemo(() => {
        const q = normalize(query);
        return terms.filter((term) => {
            if (category && term.category !== category) return false;
            if (!q) return true;
            return normalize(`${term.term} ${term.aliases.join(' ')} ${term.simple}`).includes(q);
        });
    }, [terms, query, category]);

    const letters = useMemo(() => {
        const groups = new Map<string, TermItem[]>();
        for (const term of filtered) {
            const letter = normalize(term.term)[0]?.toUpperCase() ?? '#';
            groups.set(letter, [...(groups.get(letter) ?? []), term]);
        }
        return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    useEffect(() => {
        if (selected && detailRef.current && window.matchMedia('(max-width: 1023px)').matches) {
            detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [selected]);

    return (
        <>
            <PageHeader
                eyebrow="Dictionnaire technique"
                title="Le vocabulaire des réseaux, expliqué deux fois"
                description="Chaque terme a une définition simple et une définition technique, des exemples et des liens vers les protocoles concernés. Les mêmes définitions s’ouvrent d’un clic dans les leçons."
            />
            <div className="mx-auto grid grid-cols-1 max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
                <div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <label className="relative flex-1">
                            <span className="sr-only">Chercher un terme</span>
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un terme (ex. MTU, passerelle)…" className="h-10 w-full rounded-xl border border-line bg-night-850 pr-3 pl-9 text-sm outline-none focus:border-signal/70" />
                        </label>
                        <select value={category ?? ''} onChange={(event) => setCategory(event.target.value || null)} className="h-10 rounded-xl border border-line bg-night-850 px-3 text-sm" aria-label="Catégorie">
                            <option value="">Toutes les catégories</option>
                            {categories.sort().map((item) => (
                                <option key={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
                        {filtered.length} termes
                    </p>
                    {letters.map(([letter, items]) => (
                        <section key={letter} className="mt-5" aria-label={`Lettre ${letter}`}>
                            <h2 className="font-display text-sm font-semibold text-signal">{letter}</h2>
                            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {items.map((term) => (
                                    <li key={term.slug}>
                                        <Link
                                            href={`/dictionnaire/${term.slug}`}
                                            preserveScroll
                                            preserveState
                                            className={cn('block h-full rounded-xl border p-3 transition hover:border-signal/50', selected?.slug === term.slug ? 'border-signal bg-signal/10' : 'border-line bg-surface')}
                                        >
                                            <span className="font-medium">{term.term}</span>
                                            <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{term.simple}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
                <aside ref={detailRef} className="scroll-mt-20 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto scrollbar-thin" aria-live="polite">
                    {selected ? (
                        <article className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="font-display text-2xl font-semibold">{selected.term}</h2>
                                {selected.category && <span className="rounded-full bg-night-700 px-2.5 py-0.5 text-xs">{selected.category}</span>}
                            </div>
                            {selected.aliases.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Aussi : {selected.aliases.join(', ')}</p>}
                            <h3 className="mt-5 text-xs font-semibold tracking-wide text-signal uppercase">En mots simples</h3>
                            <p className="mt-1.5 leading-relaxed">{selected.simple}</p>
                            <h3 className="mt-5 text-xs font-semibold tracking-wide text-signal uppercase">Définition technique</h3>
                            <p className="mt-1.5 leading-relaxed text-foreground/90">{selected.technical}</p>
                            {selected.example && (
                                <>
                                    <h3 className="mt-5 text-xs font-semibold tracking-wide text-signal uppercase">Exemple</h3>
                                    <p className="mt-1.5 rounded-xl bg-night-900/60 p-3 text-sm">{selected.example}</p>
                                </>
                            )}
                            {selected.protocols.length > 0 && (
                                <>
                                    <h3 className="mt-5 text-xs font-semibold tracking-wide text-signal uppercase">Protocoles concernés</h3>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selected.protocols.map((protocol) => (
                                            <Link key={protocol.slug} href={`/protocoles/${protocol.slug}`} className="rounded-full border border-line px-3 py-1 font-mono text-sm hover:border-signal/60 hover:text-signal">
                                                {protocol.acronym}
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                            {selected.related.length > 0 && (
                                <>
                                    <h3 className="mt-5 text-xs font-semibold tracking-wide text-signal uppercase">Termes liés</h3>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selected.related.map((term) => (
                                            <button key={term.slug} type="button" onClick={() => router.visit(`/dictionnaire/${term.slug}`, { preserveScroll: true, preserveState: true })} className="rounded-full border border-line px-3 py-1 text-sm hover:border-signal/60 hover:text-signal">
                                                {term.term}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </article>
                    ) : (
                        <div className="rounded-3xl border border-dashed border-line p-8 text-center text-muted-foreground">
                            <BookOpen className="mx-auto size-8 text-signal" aria-hidden />
                            <p className="mt-3">Choisis un terme pour afficher ses définitions.</p>
                        </div>
                    )}
                </aside>
            </div>
        </>
    );
}
