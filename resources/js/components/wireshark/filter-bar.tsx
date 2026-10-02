import { CircleCheck, CircleX, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PRESETS = [
    { filter: 'dns', label: 'DNS' },
    { filter: 'tcp.flags.syn == 1', label: 'SYN' },
    { filter: 'tcp.analysis.retransmission', label: 'Retransmissions' },
    { filter: 'tls', label: 'TLS' },
    { filter: 'ip.addr == 198.51.100.20', label: 'Serveur' },
    { filter: '!(arp || dns)', label: 'Sans ARP ni DNS' },
];

export function FilterBar({
    value,
    onChange,
    onApply,
    error,
    count,
    total,
}: {
    value: string;
    onChange: (value: string) => void;
    onApply: (value: string) => void;
    error: string | null;
    count: number;
    total: number;
}) {
    const valid = value.trim() !== '' && !error;
    return (
        <div className="space-y-2">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onApply(value);
                }}
                className="flex items-center gap-2"
            >
                <label className="relative flex-1">
                    <span className="sr-only">Filtre d’affichage</span>
                    <Filter className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        spellCheck={false}
                        autoCapitalize="off"
                        placeholder="Filtre d’affichage… (ex. dns, tcp.port == 443)"
                        aria-invalid={!!error}
                        aria-describedby="filter-status"
                        className={cn(
                            'h-10 w-full rounded-xl border pr-9 pl-9 font-mono text-sm outline-none',
                            error ? 'border-danger/70 bg-danger/10' : valid ? 'border-ok/60 bg-ok/8' : 'border-line bg-night-900',
                        )}
                    />
                    {value && (
                        <button type="button" onClick={() => onApply('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Effacer le filtre">
                            <X className="size-4" aria-hidden />
                        </button>
                    )}
                </label>
                <button type="submit" className="h-10 rounded-xl bg-signal px-4 text-sm font-semibold text-on-accent">
                    Appliquer
                </button>
            </form>
            <div className="flex flex-wrap items-center gap-1.5">
                {PRESETS.map((preset) => (
                    <button key={preset.filter} type="button" onClick={() => onApply(preset.filter)} className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] hover:border-signal/60 hover:text-signal" title={preset.filter}>
                        {preset.label}
                    </button>
                ))}
                <span id="filter-status" className="ml-auto flex items-center gap-1 text-xs" aria-live="polite">
                    {error ? (
                        <span className="flex items-center gap-1 text-danger">
                            <CircleX className="size-3.5" aria-hidden /> {error}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                            {value.trim() && <CircleCheck className="size-3.5 text-ok" aria-hidden />}
                            Affichés : {count} / {total}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
}
