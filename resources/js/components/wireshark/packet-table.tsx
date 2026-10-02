import { useEffect, useRef } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import type { CapturePacket } from '@/wireshark/types';
import { rowColor } from './colors';

/** Liste des paquets, navigable au clavier (flèches haut/bas). */
export function PacketTable({ packets, selected, onSelect }: { packets: CapturePacket[]; selected: number | null; onSelect: (no: number) => void }) {
    const mobile = useMediaQuery('(max-width: 767px)');
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selected === null) return;
        container.current?.querySelector<HTMLElement>(`[data-no="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [selected]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const index = packets.findIndex((packet) => packet.no === selected);
        const next = event.key === 'ArrowDown' ? Math.min(packets.length - 1, index + 1) : Math.max(0, index - 1);
        if (packets[next]) {
            onSelect(packets[next].no);
            container.current?.querySelector<HTMLElement>(`[data-no="${packets[next].no}"]`)?.focus();
        }
    };

    if (packets.length === 0) {
        return <p className="p-6 text-center text-sm text-muted-foreground">Aucun paquet ne correspond au filtre.</p>;
    }

    return (
        <div ref={container} className="max-h-[22rem] overflow-auto scrollbar-thin" onKeyDown={onKeyDown}>
            <table className="w-full min-w-max border-collapse text-left font-mono text-[12.5px]" aria-label="Liste des paquets capturés">
                <thead className="sticky top-0 z-10 bg-night-850 font-sans text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                        <th scope="col" className="px-2 py-2 font-medium">N°</th>
                        {!mobile && <th scope="col" className="px-2 py-2 font-medium">Temps</th>}
                        <th scope="col" className="px-2 py-2 font-medium">{mobile ? 'Source → Destination' : 'Source'}</th>
                        {!mobile && <th scope="col" className="px-2 py-2 font-medium">Destination</th>}
                        <th scope="col" className="px-2 py-2 font-medium">Protocole</th>
                        {!mobile && <th scope="col" className="px-2 py-2 font-medium">Longueur</th>}
                        <th scope="col" className="px-2 py-2 font-medium">Info</th>
                    </tr>
                </thead>
                <tbody>
                    {packets.map((packet) => {
                        const active = packet.no === selected;
                        return (
                            <tr
                                key={packet.no}
                                data-no={packet.no}
                                tabIndex={active || (selected === null && packet === packets[0]) ? 0 : -1}
                                aria-selected={active}
                                onClick={() => onSelect(packet.no)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(packet.no);
                                    }
                                }}
                                className={cn(
                                    'cursor-pointer border-b border-line/60 outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-inset',
                                    active ? 'bg-electric/70 text-white' : cn(rowColor[packet.color], 'hover:brightness-125'),
                                )}
                            >
                                <td className="px-2 py-1.5 text-right">{packet.no}</td>
                                {!mobile && <td className="px-2 py-1.5">{packet.time.toFixed(6)}</td>}
                                <td className="px-2 py-1.5">
                                    {packet.src}
                                    {mobile && <span className="block text-[11px] opacity-75">→ {packet.dst}</span>}
                                </td>
                                {!mobile && <td className="px-2 py-1.5">{packet.dst}</td>}
                                <td className="px-2 py-1.5">{packet.protocol}</td>
                                {!mobile && <td className="px-2 py-1.5 text-right">{packet.length}</td>}
                                <td className="max-w-[34rem] truncate px-2 py-1.5" title={packet.info}>
                                    {packet.info}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
