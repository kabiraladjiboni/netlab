import { Link } from '@inertiajs/react';
import { ChevronRight, Lock, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { KNOWN_FIELDS } from '@/wireshark/filter';
import type { CapturePacket, TreeField, TreeLayer } from '@/wireshark/types';

const filterable = (name?: string) => !!name && (KNOWN_FIELDS as readonly string[]).includes(name);

const kindColor: Record<TreeLayer['kind'], string> = {
    frame: 'text-muted-foreground',
    link: 'text-layer-link',
    network: 'text-layer-network',
    transport: 'text-layer-transport',
    security: 'text-violet',
    app: 'text-layer-app',
};

/** Détails d'un paquet : explication courante (débutant) ou arbre de protocoles (avancé). */
export function PacketDetails({ packet, mode, onUseFilter }: { packet: CapturePacket; mode: 'beginner' | 'advanced'; onUseFilter: (filter: string) => void }) {
    if (mode === 'beginner') {
        return (
            <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-signal/15 px-2 py-0.5 font-mono text-xs font-semibold text-signal">{packet.protocol}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                        Paquet n° {packet.no} · {packet.length} octets · t = {packet.time.toFixed(3)} s
                    </span>
                </div>
                <p className="text-sm">
                    <span className="font-mono">{packet.src}</span> <span className="text-muted-foreground">→</span> <span className="font-mono">{packet.dst}</span>
                </p>
                {packet.beginner ? (
                    <div>
                        <h3 className="text-xs font-semibold tracking-wide text-signal uppercase">En langage courant</h3>
                        <p className="mt-1.5 leading-relaxed">{packet.beginner}</p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Paquet importé : seul le résumé technique est disponible. Ligne « Info » : <span className="font-mono">{packet.info}</span>
                    </p>
                )}
                {packet.role && (
                    <div>
                        <h3 className="text-xs font-semibold tracking-wide text-signal uppercase">Rôle dans l’échange</h3>
                        <p className="mt-1.5 text-sm text-foreground/85">{packet.role}</p>
                    </div>
                )}
                {packet.encrypted && (
                    <p className="flex gap-2 rounded-xl border border-violet/40 bg-violet/8 p-3 text-sm">
                        <Lock className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
                        Le contenu applicatif est chiffré : Wireshark voit qu’il y a des données, mais pas ce qu’elles contiennent.
                    </p>
                )}
                {packet.lesson && (
                    <Link href={packet.lesson.href} className="inline-flex items-center gap-2 rounded-xl border border-signal/40 px-3 py-2 text-sm font-medium text-signal hover:bg-signal/10">
                        <PlayCircle className="size-4" aria-hidden /> Voir dans l’animation : {packet.lesson.label}
                    </Link>
                )}
            </div>
        );
    }

    return (
        <div className="p-2 font-mono text-[12.5px] sm:p-3" role="tree" aria-label="Arbre des protocoles">
            {packet.tree.map((layer, index) => (
                <LayerNode key={`${layer.title}-${index}`} layer={layer} defaultOpen={index > 0 && index === packet.tree.length - 1} onUseFilter={onUseFilter} />
            ))}
        </div>
    );
}

function LayerNode({ layer, defaultOpen, onUseFilter }: { layer: TreeLayer; defaultOpen: boolean; onUseFilter: (filter: string) => void }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div role="treeitem" aria-expanded={open}>
            <button type="button" onClick={() => setOpen(!open)} className={cn('flex w-full items-start gap-1 rounded px-1 py-1 text-left hover:bg-night-700/60', kindColor[layer.kind])}>
                <ChevronRight className={cn('mt-0.5 size-3.5 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
                <span className="font-semibold break-all">{layer.title}</span>
            </button>
            {open && (
                <ul role="group" className="ml-5 border-l border-line/60 pl-2">
                    {layer.fields.map((field, index) => (
                        <FieldNode key={`${field.label}-${index}`} field={field} onUseFilter={onUseFilter} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function FieldNode({ field, onUseFilter }: { field: TreeField; onUseFilter: (filter: string) => void }) {
    const [open, setOpen] = useState(false);
    const expandable = !!(field.explain || field.children || filterable(field.filter));
    return (
        <li role="treeitem" aria-expanded={expandable ? open : undefined}>
            <button type="button" onClick={() => expandable && setOpen(!open)} className={cn('flex w-full items-start gap-1 rounded px-1 py-0.5 text-left text-foreground/90', expandable && 'hover:bg-night-700/60')}>
                {expandable ? <ChevronRight className={cn('mt-0.5 size-3 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden /> : <span className="w-3 shrink-0" />}
                <span className="break-all">{field.label}</span>
            </button>
            {open && (
                <div className="mb-1 ml-4 space-y-1 font-sans text-xs">
                    {field.explain && <p className="rounded-lg bg-night-900/70 px-2 py-1.5 text-muted-foreground">{field.explain}</p>}
                    {filterable(field.filter) && (
                        <button type="button" onClick={() => onUseFilter(field.filter!.startsWith('tcp.flags.') ? `${field.filter} == 1` : field.filter!)} className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-signal hover:border-signal/60">
                            Filtrer avec {field.filter}
                        </button>
                    )}
                    {field.children && (
                        <ul className="ml-1 border-l border-line/60 pl-2 font-mono text-[12px]">
                            {field.children.map((child, index) => (
                                <FieldNode key={`${child.label}-${index}`} field={child} onUseFilter={onUseFilter} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </li>
    );
}
