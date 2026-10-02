import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** QR code généré dans le navigateur (aucun service externe : le secret ne quitte pas la page). */
export function QrCode({ value, label, size = 200 }: { value: string; label: string; size?: number }) {
    const [svg, setSvg] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#101D35', light: '#FFFFFF' } })
            .then((markup) => active && setSvg(markup))
            .catch(() => active && setSvg(null));
        return () => {
            active = false;
        };
    }, [value]);
    if (!svg) return <div className="animate-pulse rounded-xl bg-night-800" style={{ width: size, height: size }} aria-hidden />;
    // Le balisage SVG vient de la bibliothèque qrcode (aucune donnée HTML externe) : on l'affiche comme image.
    return <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} width={size} height={size} alt={label} className="rounded-xl bg-white p-2" />;
}
