import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { inputClass } from '@/components/forms/fields';
import { normalize } from '@/lib/utils';
import { cn } from '@/lib/utils';

function move<T>(items: T[], from: number, to: number): T[] {
    if (to < 0 || to >= items.length) return items;
    const copy = [...items];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
}

function RowTools({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void; label: string }) {
    return (
        <div className="flex shrink-0 gap-0.5">
            <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0} className="rounded-md p-1.5 text-muted-foreground hover:bg-night-800 disabled:opacity-30" aria-label={`Monter ${label}`}>
                <ArrowUp className="size-3.5" aria-hidden />
            </button>
            <button type="button" onClick={() => onMove(index + 1)} disabled={index === count - 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-night-800 disabled:opacity-30" aria-label={`Descendre ${label}`}>
                <ArrowDown className="size-3.5" aria-hidden />
            </button>
            <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer ${label}`}>
                <Trash2 className="size-3.5" aria-hidden />
            </button>
        </div>
    );
}

/** Liste de textes (erreurs fréquentes, indices, choix…). */
export function StringListEditor({ label, items, onChange, placeholder, error, hint, multiline = false, addLabel = 'Ajouter', min = 0 }: { label: ReactNode; items: string[]; onChange: (items: string[]) => void; placeholder?: string; error?: string; hint?: ReactNode; multiline?: boolean; addLabel?: string; min?: number }) {
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{label}</legend>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <ol className="space-y-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                        <span className="mt-2.5 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{index + 1}</span>
                        {multiline ? (
                            <textarea value={item} rows={2} onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))} placeholder={placeholder} className={cn(inputClass, 'py-2')} aria-label={`${typeof label === 'string' ? label : 'Élément'} ${index + 1}`} />
                        ) : (
                            <input value={item} onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))} placeholder={placeholder} className={cn(inputClass, 'py-2')} aria-label={`${typeof label === 'string' ? label : 'Élément'} ${index + 1}`} />
                        )}
                        <RowTools index={index} count={items.length} label={`l’élément ${index + 1}`} onMove={(to) => onChange(move(items, index, to))} onRemove={() => items.length > min && onChange(items.filter((_, i) => i !== index))} />
                    </li>
                ))}
            </ol>
            <button type="button" onClick={() => onChange([...items, ''])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted-foreground hover:border-signal/50 hover:text-foreground">
                <Plus className="size-4" aria-hidden /> {addLabel}
            </button>
            {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </fieldset>
    );
}

export type Column<T> = { key: keyof T & string; label: string; placeholder?: string; width?: string; type?: 'text' | 'select' | 'textarea'; options?: { value: string; label: string }[] };

/** Tableau éditable d'objets (ports, champs, échanges, références…). */
export function RowsEditor<T extends Record<string, unknown>>({ label, rows, onChange, columns, empty, error, hint, addLabel = 'Ajouter une ligne' }: { label: ReactNode; rows: T[]; onChange: (rows: T[]) => void; columns: Column<T>[]; empty: T; error?: string; hint?: ReactNode; addLabel?: string }) {
    const update = (index: number, key: string, value: string) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{label}</legend>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {rows.length > 0 && (
                <ol className="space-y-2">
                    {rows.map((row, index) => (
                        <li key={index} className="flex items-start gap-2 rounded-xl border border-line bg-night-850/50 p-2">
                            <span className="mt-2.5 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{index + 1}</span>
                            <div className="grid grid-cols-1 min-w-0 flex-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
                                {columns.map((column) => (
                                    <label key={column.key} className={cn('block min-w-0', column.width)}>
                                        <span className="mb-0.5 block text-[11px] text-muted-foreground">{column.label}</span>
                                        {column.type === 'select' ? (
                                            <select value={String(row[column.key] ?? '')} onChange={(e) => update(index, column.key, e.target.value)} className={cn(inputClass, 'py-1.5 text-[13px]')}>
                                                <option value="">—</option>
                                                {column.options?.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : column.type === 'textarea' ? (
                                            <textarea value={String(row[column.key] ?? '')} rows={2} onChange={(e) => update(index, column.key, e.target.value)} placeholder={column.placeholder} className={cn(inputClass, 'py-1.5 text-[13px]')} />
                                        ) : (
                                            <input value={String(row[column.key] ?? '')} onChange={(e) => update(index, column.key, e.target.value)} placeholder={column.placeholder} className={cn(inputClass, 'py-1.5 text-[13px]')} />
                                        )}
                                    </label>
                                ))}
                            </div>
                            <RowTools index={index} count={rows.length} label={`la ligne ${index + 1}`} onMove={(to) => onChange(move(rows, index, to))} onRemove={() => onChange(rows.filter((_, i) => i !== index))} />
                        </li>
                    ))}
                </ol>
            )}
            <button type="button" onClick={() => onChange([...rows, { ...empty }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted-foreground hover:border-signal/50 hover:text-foreground">
                <Plus className="size-4" aria-hidden /> {addLabel}
            </button>
            {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </fieldset>
    );
}

/** Sélection multiple avec recherche (couches, termes, protocoles…). */
export function MultiPick<V extends string | number>({ label, options, value, onChange, hint, error, height = 'max-h-56' }: { label: ReactNode; options: { value: V; label: string; group?: string }[]; value: V[]; onChange: (value: V[]) => void; hint?: ReactNode; error?: string; height?: string }) {
    const [query, setQuery] = useState('');
    const selected = useMemo(() => new Set(value), [value]);
    const filtered = useMemo(() => {
        const q = normalize(query);
        return q ? options.filter((option) => normalize(option.label).includes(q)) : options;
    }, [options, query]);
    const toggle = (v: V) => onChange(selected.has(v) ? value.filter((item) => item !== v) : [...value, v]);

    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
                {label} <span className="font-normal text-muted-foreground">({value.length})</span>
            </legend>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {value.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {options
                        .filter((option) => selected.has(option.value))
                        .map((option) => (
                            <li key={String(option.value)}>
                                <button type="button" onClick={() => toggle(option.value)} className="inline-flex items-center gap-1 rounded-full border border-signal/40 bg-signal/10 px-2.5 py-0.5 text-xs" aria-label={`Retirer ${option.label}`}>
                                    {option.label} <X className="size-3" aria-hidden />
                                </button>
                            </li>
                        ))}
                </ul>
            )}
            <div className="rounded-xl border border-line">
                <div className="relative border-b border-line">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer la liste" className="w-full rounded-t-xl bg-transparent py-2 pr-3 pl-8 text-sm outline-none" />
                </div>
                <ul className={cn('overflow-y-auto p-1 scrollbar-thin', height)}>
                    {filtered.map((option) => (
                        <li key={String(option.value)}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-night-800">
                                <input type="checkbox" checked={selected.has(option.value)} onChange={() => toggle(option.value)} className="size-4 accent-[var(--color-signal)]" />
                                {option.label}
                                {option.group && <span className="ml-auto text-[11px] text-muted-foreground">{option.group}</span>}
                            </label>
                        </li>
                    ))}
                    {filtered.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">Aucun résultat.</li>}
                </ul>
            </div>
            {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </fieldset>
    );
}

/** Barre d'enregistrement collante : statut de publication + bouton. */
export function SaveBar({ status, onStatus, processing, dirty, extra }: { status: string; onStatus: (status: 'draft' | 'published') => void; processing: boolean; dirty: boolean; extra?: ReactNode }) {
    return (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-popover/95 p-3 shadow-xl shadow-[var(--shadow-color)] backdrop-blur">
            <div role="radiogroup" aria-label="Statut de publication" className="inline-flex rounded-xl border border-line p-0.5">
                {(['draft', 'published'] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={status === value}
                        onClick={() => onStatus(value)}
                        className={cn('rounded-[10px] px-3 py-1.5 text-sm', status === value ? (value === 'published' ? 'bg-ok/15 font-semibold text-ok' : 'bg-warn/15 font-semibold text-warn') : 'text-muted-foreground')}
                    >
                        {value === 'published' ? 'Publié' : 'Brouillon'}
                    </button>
                ))}
            </div>
            <span className="text-xs text-muted-foreground">{dirty ? 'Modifications non enregistrées' : 'Aucune modification en attente'}</span>
            <div className="ml-auto flex items-center gap-2">
                {extra}
                <button type="submit" disabled={processing} className="inline-flex items-center gap-2 rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60">
                    {processing && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
                    Enregistrer
                </button>
            </div>
        </div>
    );
}
