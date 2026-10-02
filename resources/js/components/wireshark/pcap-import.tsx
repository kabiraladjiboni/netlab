import { FileUp, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PCAP_LIMITS, PcapError, parseCapture } from '@/wireshark/pcap';
import type { Capture } from '@/wireshark/types';

/**
 * Import d'un fichier PCAP/PCAPNG.
 * Le fichier est lu et analysé uniquement dans le navigateur : il n'est jamais envoyé au serveur.
 * L'analyse est volontairement basique (dissecteurs limités) : ce n'est pas un remplaçant de Wireshark.
 */
export function PcapImport({ onLoaded }: { onLoaded: (capture: Capture, warnings: string[]) => void }) {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = async (file: File | undefined) => {
        if (!file) return;
        setError(null);
        if (!/\.(pcap|pcapng|cap)$/i.test(file.name)) {
            setError('Extension non reconnue : choisis un fichier .pcap ou .pcapng.');
            return;
        }
        if (file.size > PCAP_LIMITS.maxBytes) {
            setError(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Limite : ${PCAP_LIMITS.maxBytes / 1024 / 1024} Mo.`);
            return;
        }
        setBusy(true);
        try {
            const result = parseCapture(await file.arrayBuffer());
            const warnings = [...result.warnings];
            if (result.truncated) warnings.unshift(`Seuls les ${PCAP_LIMITS.maxPackets} premiers paquets sont affichés.`);
            onLoaded(
                {
                    id: 'import',
                    title: file.name,
                    description: `Fichier ${result.format.toUpperCase()} importé — ${result.total} paquet(s) lu(s). Analyse basique réalisée dans ton navigateur.`,
                    pedagogical: false,
                    packets: result.packets,
                    missions: [],
                },
                warnings,
            );
        } catch (caught) {
            setError(caught instanceof PcapError ? caught.message : 'Impossible de lire ce fichier.');
        } finally {
            setBusy(false);
            if (input.current) input.current.value = '';
        }
    };

    return (
        <div className="rounded-xl border border-dashed border-line bg-surface/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                    Importer une capture (.pcap / .pcapng)
                </Button>
                <input
                    ref={input}
                    type="file"
                    accept=".pcap,.pcapng,.cap,application/vnd.tcpdump.pcap"
                    className="sr-only"
                    aria-label="Fichier de capture"
                    onChange={(event) => handle(event.target.files?.[0])}
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-ok" />
                    Analyse basique dans le navigateur — le fichier n'est pas envoyé. Max {PCAP_LIMITS.maxBytes / 1024 / 1024} Mo, {PCAP_LIMITS.maxPackets} paquets.
                </p>
            </div>
            {error && (
                <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-danger">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
}
