import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { inputClass } from '@/components/forms/fields';
import { cn } from '@/lib/utils';

export function AdminPage({ title, description, actions, children, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; back?: { href: string; label: string } }) {
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    {back && (
                        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            <ChevronLeft className="size-4" aria-hidden /> {back.label}
                        </Link>
                    )}
                    <h1 className="font-display text-2xl font-semibold sm:text-[1.75rem]">{title}</h1>
                    {description && <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</div>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
        </div>
    );
}

export function Panel({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
    return (
        <section className={cn('rounded-2xl border border-line bg-card', className)}>
            {(title || actions) && (
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
                    <div>
                        {title && <h2 className="font-display text-base font-semibold">{title}</h2>}
                        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
                    </div>
                    {actions}
                </div>
            )}
            <div className={cn(padded && 'p-5')}>{children}</div>
        </section>
    );
}

export function Definition({ children }: { children: ReactNode }) {
    return (
        <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden />
            <span>{children}</span>
        </p>
    );
}

export function ButtonLink({ href, children, variant = 'primary', className }: { href: string; children: ReactNode; variant?: 'primary' | 'outline'; className?: string }) {
    return (
        <Link
            href={href}
            className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                variant === 'primary' ? 'bg-signal text-on-accent hover:brightness-110' : 'border border-line hover:bg-night-800',
                className,
            )}
        >
            {children}
        </Link>
    );
}

export function StatusPill({ status }: { status: string }) {
    const map: Record<string, [string, string]> = {
        published: ['Publié', 'border-ok/40 bg-ok/10 text-ok'],
        draft: ['Brouillon', 'border-warn/40 bg-warn/10 text-warn'],
        new: ['Nouveau', 'border-signal/40 bg-signal/10 text-signal'],
        in_progress: ['En cours', 'border-warn/40 bg-warn/10 text-warn'],
        resolved: ['Résolu', 'border-ok/40 bg-ok/10 text-ok'],
        closed: ['Fermé', 'border-line bg-night-800 text-muted-foreground'],
        completed: ['Terminé', 'border-ok/40 bg-ok/10 text-ok'],
        pending: ['À modérer', 'border-warn/40 bg-warn/10 text-warn'],
        approved: ['Validé', 'border-ok/40 bg-ok/10 text-ok'],
        hidden: ['Masqué', 'border-line bg-night-800 text-muted-foreground'],
        high: ['Haute', 'border-danger/40 bg-danger/10 text-danger'],
        normal: ['Normale', 'border-line bg-night-800 text-foreground/80'],
        low: ['Basse', 'border-line bg-night-800 text-muted-foreground'],
        builtin: ['Intégré', 'border-electric/40 bg-electric/10 text-electric'],
        custom: ['Personnalisé', 'border-violet/40 bg-violet/10 text-violet'],
    };
    const [label, className] = map[status] ?? [status, 'border-line text-muted-foreground'];
    return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', className)}>{label}</span>;
}

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export function Pagination({ page }: { page: Paginated<unknown> }) {
    if (page.last_page <= 1) return <p className="px-5 py-3 text-xs text-muted-foreground">{page.total} élément(s)</p>;
    return (
        <div className="flex items-center justify-between gap-3 border-t border-line/70 px-5 py-3 text-sm">
            <span className="text-xs text-muted-foreground">
                {page.from}–{page.to} sur {page.total}
            </span>
            <div className="flex gap-1">
                <PageLink href={page.prev_page_url} label="Page précédente">
                    <ChevronLeft className="size-4" aria-hidden />
                </PageLink>
                <span className="px-2 py-1.5 text-xs text-muted-foreground">
                    Page {page.current_page} / {page.last_page}
                </span>
                <PageLink href={page.next_page_url} label="Page suivante">
                    <ChevronRight className="size-4" aria-hidden />
                </PageLink>
            </div>
        </div>
    );
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
    if (!href) return <span className="flex size-8 items-center justify-center rounded-lg border border-line opacity-40">{children}</span>;
    return (
        <Link href={href} preserveScroll className="flex size-8 items-center justify-center rounded-lg border border-line hover:bg-night-800" aria-label={label}>
            {children}
        </Link>
    );
}

/** Tableau responsive : défilement horizontal sur petit écran. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
    return (
        <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-line/70 text-xs text-muted-foreground">
                    <tr>
                        {head.map((cell, index) => (
                            <th key={index} scope="col" className="px-4 py-2.5 font-medium first:pl-5 last:pr-5">
                                {cell}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-line/50 [&_td]:px-4 [&_td]:py-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">{children}</tbody>
            </table>
            {empty}
        </div>
    );
}

export function EmptyState({ icon: Icon, title, children }: { icon?: typeof Info; title: string; children?: ReactNode }) {
    return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
            {Icon && <Icon className="size-8 text-muted-foreground" aria-hidden />}
            <p className="mt-3 font-medium">{title}</p>
            {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
        </div>
    );
}

/** Confirmation avant une opération destructive ou sensible. */
export function ConfirmButton({
    title,
    description,
    confirmLabel = 'Confirmer',
    onConfirm,
    children,
    danger = true,
    requireText,
    className,
}: {
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    onConfirm: (typed: string) => void;
    children: ReactNode;
    danger?: boolean;
    requireText?: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const ok = !requireText || typed === requireText;
    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={className}>
                {children}
            </button>
            <Dialog open={open} onOpenChange={(value) => { setOpen(value); setTyped(''); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription asChild>
                            <div className="text-sm text-muted-foreground">{description}</div>
                        </DialogDescription>
                    </DialogHeader>
                    {requireText && (
                        <label className="block space-y-1.5 text-sm">
                            <span>
                                Pour confirmer, saisis <strong className="font-mono">{requireText}</strong>
                            </span>
                            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} autoFocus />
                        </label>
                    )}
                    <DialogFooter>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2 text-sm">
                            Annuler
                        </button>
                        <button
                            type="button"
                            disabled={!ok}
                            onClick={() => {
                                setOpen(false);
                                onConfirm(typed);
                                setTyped('');
                            }}
                            className={cn('rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50', danger ? 'bg-danger text-white' : 'bg-signal text-on-accent')}
                        >
                            {confirmLabel}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Filtres envoyés en paramètres d'URL. */
export function applyFilters(url: string, values: Record<string, string | null | undefined>) {
    const params = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    router.get(url, params as Record<string, string>, { preserveState: true, preserveScroll: true, replace: true });
}

export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn(inputClass, 'w-auto py-2')}>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
