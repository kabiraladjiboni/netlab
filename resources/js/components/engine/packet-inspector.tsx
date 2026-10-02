import { ArrowRight, CircleHelp, Info, Send, Target } from 'lucide-react';
import { useState } from 'react';
import { renderInline } from '@/components/content/rich-text';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FieldLayer, PacketDetails } from '@/engine/types';
import type { Level } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

export const layerStyle: Record<FieldLayer, { label: string; className: string; dot: string }> = {
    app: { label: 'Application', className: 'border-layer-app/40 bg-layer-app/8', dot: 'bg-layer-app' },
    security: { label: 'Sécurité', className: 'border-violet/40 bg-violet/8', dot: 'bg-violet' },
    transport: { label: 'Transport', className: 'border-layer-transport/40 bg-layer-transport/8', dot: 'bg-layer-transport' },
    network: { label: 'Réseau', className: 'border-layer-network/40 bg-layer-network/8', dot: 'bg-layer-network' },
    link: { label: 'Liaison', className: 'border-layer-link/40 bg-layer-link/8', dot: 'bg-layer-link' },
};

const tabs: { value: Level; label: string }[] = [
    { value: 1, label: 'Débutant' },
    { value: 2, label: 'Intermédiaire' },
    { value: 3, label: 'Avancé' },
];

/**
 * Inspecteur de paquet en trois niveaux. Les valeurs affichées sont celles
 * du paquet À CETTE ÉTAPE : elles peuvent changer d'un saut à l'autre
 * (TTL, en-tête de liaison, traduction NAT…).
 */
export function PacketInspector({ packet, level }: { packet: PacketDetails; level: Level }) {
    const [tab, setTab] = useState<Level>(level);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-signal/15 px-2 py-0.5 font-mono text-xs font-semibold text-signal">{packet.protocol}</span>
                <p className="font-display text-[15px] font-semibold">{packet.title}</p>
            </div>
            <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Où :</span> {packet.where}
                {packet.size && <> · Taille : {packet.size}</>}
            </p>

            <Tabs value={String(tab)} onValueChange={(value) => setTab(Number(value) as Level)}>
                <TabsList aria-label="Niveau de détail du paquet">
                    {tabs.map((item) => (
                        <TabsTrigger key={item.value} value={String(item.value)}>
                            {item.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="1">
                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                            { icon: Send, label: 'Qui envoie ?', value: packet.beginner.who },
                            { icon: Target, label: 'À qui ?', value: packet.beginner.to },
                            { icon: CircleHelp, label: 'Pourquoi ?', value: packet.beginner.why },
                            { icon: ArrowRight, label: 'Et ensuite ?', value: packet.beginner.next },
                        ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-line bg-night-900/50 p-3">
                                <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-signal uppercase">
                                    <item.icon className="size-3.5" aria-hidden /> {item.label}
                                </dt>
                                <dd className="text-sm leading-snug">{renderInline(item.value)}</dd>
                            </div>
                        ))}
                    </dl>
                </TabsContent>

                {([2, 3] as const).map((value) => (
                    <TabsContent key={value} value={String(value)} className="space-y-2">
                        {packet.layers.map((layer) => {
                            const fields = layer.fields.filter((field) => field.level <= value);
                            if (fields.length === 0) return null;
                            const style = layerStyle[layer.layer];
                            return (
                                <section key={layer.name} className={cn('rounded-xl border p-3', style.className)} aria-label={`En-tête ${layer.name}`}>
                                    <h4 className="mb-2 flex items-center gap-2 font-sans text-[13px] font-semibold">
                                        <span className={cn('size-2 rounded-full', style.dot)} aria-hidden />
                                        {layer.name}
                                        <span className="text-[11px] font-normal text-muted-foreground">· {style.label}</span>
                                    </h4>
                                    <dl className="divide-y divide-line/60">
                                        {fields.map((field) => (
                                            <div key={field.name} className="grid grid-cols-[minmax(0,9.5rem)_1fr] gap-x-3 gap-y-0.5 py-1.5 text-[13px]">
                                                <dt className="text-muted-foreground">{field.name}</dt>
                                                <dd className="min-w-0">
                                                    <span className={cn('font-mono break-all', field.changed ? 'text-warn' : 'text-foreground')}>{field.value}</span>
                                                    {field.changed && (
                                                        <span className="ml-2 rounded bg-warn/15 px-1.5 py-px text-[10px] font-semibold text-warn uppercase">modifié</span>
                                                    )}
                                                    {value === 3 && field.explain && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{renderInline(field.explain)}</p>}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                    {value === 3 && layer.note && <p className="mt-2 text-xs text-muted-foreground">{renderInline(layer.note)}</p>}
                                </section>
                            );
                        })}
                        {value === 2 && (
                            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Le niveau « Avancé » montre tous les champs et leur explication.
                            </p>
                        )}
                    </TabsContent>
                ))}
            </Tabs>
            {packet.note && (
                <p className="rounded-lg border border-warn/30 bg-warn/5 p-2.5 text-xs leading-relaxed text-foreground/85">{renderInline(packet.note)}</p>
            )}
        </div>
    );
}
