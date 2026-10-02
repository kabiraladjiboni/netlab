import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { OSI_NAMES, osiLayerColor, TCPIP_NAMES, tcpipLayerColor } from '@/lib/labels';

/** Mini-représentation des modèles OSI et TCP/IP, couches concernées mises en évidence. */
export function LayerStack({ osi, tcpip }: { osi: number[]; tcpip: number[] }) {
    return (
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Positionnement dans les modèles">
            <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Modèle OSI</p>
                <ol className="flex flex-col-reverse gap-1">
                    {OSI_NAMES.map((name, index) => {
                        const n = index + 1;
                        const on = osi.includes(n);
                        return (
                            <li key={name}>
                                <Link
                                    href={`/modeles/osi?couche=${n}`}
                                    className={cn('flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition', on ? 'border-signal/60 bg-signal/12 font-semibold text-foreground' : 'border-line/60 text-muted-foreground/70 hover:text-foreground')}
                                    aria-current={on ? 'true' : undefined}
                                >
                                    <span className={cn('size-2 rounded-full', on ? osiLayerColor(n) : 'bg-night-600')} aria-hidden />
                                    {n}. {name}
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            </div>
            <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Modèle TCP/IP</p>
                <ol className="flex h-[calc(100%-1.4rem)] flex-col-reverse gap-1">
                    {TCPIP_NAMES.map((name, index) => {
                        const n = index + 1;
                        const on = tcpip.includes(n);
                        const span = n === 4 ? 'flex-[3]' : n === 1 ? 'flex-[2]' : 'flex-1';
                        return (
                            <li key={name} className={cn('flex', span)}>
                                <Link
                                    href={`/modeles/tcp-ip?couche=${n}`}
                                    className={cn('flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-xs transition', on ? 'border-signal/60 bg-signal/12 font-semibold text-foreground' : 'border-line/60 text-muted-foreground/70 hover:text-foreground')}
                                >
                                    <span className={cn('size-2 rounded-full', on ? tcpipLayerColor(n) : 'bg-night-600')} aria-hidden />
                                    {name}
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}
