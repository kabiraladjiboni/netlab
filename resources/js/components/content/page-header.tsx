import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    className,
}: {
    eyebrow?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <header className={cn('mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 sm:pt-12', className)}>
            {eyebrow && <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-signal uppercase">{eyebrow}</p>}
            <h1 className="max-w-4xl font-display text-3xl leading-tight font-semibold sm:text-4xl lg:text-[2.75rem]">{title}</h1>
            {description && <div className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</div>}
            {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        </header>
    );
}

export function Section({ title, description, children, className, id }: { title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string; id?: string }) {
    return (
        <section id={id} className={cn('mx-auto max-w-7xl px-4 py-8 sm:px-6', className)}>
            {title && <h2 className="font-display text-2xl font-semibold sm:text-[1.75rem]">{title}</h2>}
            {description && <p className="mt-2 max-w-3xl text-muted-foreground">{description}</p>}
            <div className={title || description ? 'mt-6' : undefined}>{children}</div>
        </section>
    );
}
