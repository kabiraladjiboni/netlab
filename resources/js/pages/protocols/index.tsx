import { Link } from '@inertiajs/react';
import { CircleDashed, Filter, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/content/page-header';
import { cn, normalize } from '@/lib/utils';
import { OSI_NAMES, statusLabels } from '@/lib/labels';
import type { ProtocolStatus, ProtocolSummary } from '@/types/content';

type Category = { slug: string; name: string; description: string; planned: string[]; protocols: ProtocolSummary[] };

export default function ProtocolsIndex({ categories }: { categories: Category[] }) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string | null>(null);
    const [layer, setLayer] = useState<number | null>(null);
    const [status, setStatus] = useState<ProtocolStatus | null>(null);

    const total = categories.reduce((sum, item) => sum + item.protocols.length, 0);

    const filtered = useMemo(() => {
        const q = normalize(query);
        return categories
            .filter((item) => !category || item.slug === category)
            .map((item) => ({
                ...item,
                protocols: item.protocols.filter((protocol) => {
                    if (status && protocol.status !== status) return false;
                    if (layer && !protocol.layers.some((l) => l.model === 'osi' && l.number === layer)) return false;
                    if (!q) return true;
                    const haystack = normalize(`${protocol.acronym} ${protocol.name} ${protocol.summary} ${protocol.ports.map((p) => `port ${p.number}`).join(' ')}`);
                    return q.split(' ').every((word) => haystack.includes(word));
                }),
            }));
    }, [categories, query, category, layer, status]);

    const shown = filtered.reduce((sum, item) => sum + item.protocols.length, 0);
    const hasFilter = query || category || layer || status;

    return (
        <>
            <PageHeader
                eyebrow="Catalogue"
                title="Les protocoles, mécanismes et outils des réseaux"
                description={
                    <>
                        {total} fiches organisées par famille et reliées aux couches OSI et TCP/IP. Les fiches <strong className="text-foreground">complètes</strong> détaillent champs, échanges et captures ; les fiches <strong className="text-foreground">essentielles</strong> donnent l’essentiel vérifié et seront enrichies. Ce catalogue ne prétend pas couvrir tous les protocoles existants.
                    </>
                }
            />

            <div className="sticky top-16 z-30 border-y border-line/60 bg-night-900/85 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
                    <label className="relative flex-1">
                        <span className="sr-only">Filtrer les protocoles</span>
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filtrer : sigle, nom, port (ex. « port 443 »)…"
                            className="h-10 w-full rounded-xl border border-line bg-night-850 pr-3 pl-9 text-sm outline-none focus:border-signal/70"
                        />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                        <Filter className="size-4 text-muted-foreground" aria-hidden />
                        <select value={category ?? ''} onChange={(event) => setCategory(event.target.value || null)} className="h-10 rounded-xl border border-line bg-night-850 px-3 text-sm" aria-label="Famille">
                            <option value="">Toutes les familles</option>
                            {categories.map((item) => (
                                <option key={item.slug} value={item.slug}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                        <select value={layer ?? ''} onChange={(event) => setLayer(event.target.value ? Number(event.target.value) : null)} className="h-10 rounded-xl border border-line bg-night-850 px-3 text-sm" aria-label="Couche OSI">
                            <option value="">Toutes les couches OSI</option>
                            {OSI_NAMES.map((name, index) => (
                                <option key={name} value={index + 1}>
                                    Couche {index + 1} — {name}
                                </option>
                            ))}
                        </select>
                        <select value={status ?? ''} onChange={(event) => setStatus((event.target.value || null) as ProtocolStatus | null)} className="h-10 rounded-xl border border-line bg-night-850 px-3 text-sm" aria-label="Nature">
                            <option value="">Toutes les natures</option>
                            {Object.entries(statusLabels).map(([key, value]) => (
                                <option key={key} value={key}>
                                    {value.label}
                                </option>
                            ))}
                        </select>
                        {hasFilter && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    setCategory(null);
                                    setLayer(null);
                                    setStatus(null);
                                }}
                                className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-4" aria-hidden /> Effacer
                            </button>
                        )}
                    </div>
                </div>
                <p className="sr-only" aria-live="polite">
                    {shown} protocoles affichés
                </p>
            </div>

            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                {shown === 0 && <p className="py-16 text-center text-muted-foreground">Aucune fiche ne correspond à ces filtres.</p>}
                {filtered.map((item) =>
                    item.protocols.length === 0 ? null : (
                        <section key={item.slug} id={item.slug} className="scroll-mt-36 py-8" aria-labelledby={`cat-${item.slug}`}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h2 id={`cat-${item.slug}`} className="font-display text-2xl font-semibold">
                                    {item.name}
                                </h2>
                                <span className="text-sm text-muted-foreground">{item.protocols.length} fiches</span>
                            </div>
                            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{item.description}</p>
                            <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {item.protocols.map((protocol) => (
                                    <li key={protocol.slug}>
                                        <ProtocolCard protocol={protocol} />
                                    </li>
                                ))}
                            </ul>
                            {!hasFilter && item.planned.length > 0 && (
                                <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <CircleDashed className="size-3.5" aria-hidden /> À ajouter prochainement :
                                    {item.planned.map((name) => (
                                        <span key={name} className="rounded-full border border-dashed border-line px-2 py-0.5">
                                            {name}
                                        </span>
                                    ))}
                                </p>
                            )}
                        </section>
                    ),
                )}
            </div>
        </>
    );
}

export function ProtocolCard({ protocol }: { protocol: ProtocolSummary }) {
    const status = statusLabels[protocol.status];
    const osi = protocol.layers.filter((l) => l.model === 'osi').map((l) => l.number);
    return (
        <Link href={`/protocoles/${protocol.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-signal/50">
            <div className="flex items-start justify-between gap-2">
                <span className="font-display text-lg font-semibold group-hover:text-signal">{protocol.acronym}</span>
                <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-medium', status.className)}>{status.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">{protocol.name}</span>
            <p className="mt-2 flex-1 text-sm leading-snug text-foreground/85">{protocol.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                {osi.length > 0 && <span className="rounded-md bg-night-700 px-1.5 py-0.5 font-mono">OSI {osi.join('·')}</span>}
                {protocol.ports.slice(0, 2).map((port) => (
                    <span key={`${port.number}-${port.transport}`} className="rounded-md bg-night-700 px-1.5 py-0.5 font-mono">
                        {port.transport} {port.number}
                    </span>
                ))}
                {protocol.completeness === 'complete' && <span className="ml-auto rounded-md bg-signal/12 px-1.5 py-0.5 text-signal">fiche complète</span>}
            </div>
        </Link>
    );
}
