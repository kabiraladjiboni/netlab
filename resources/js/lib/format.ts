const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const numberFormat = new Intl.NumberFormat('fr-FR');
const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

export function formatDate(value: string | null | undefined): string {
    return value ? dateFormat.format(new Date(value)) : '—';
}

export function formatDateTime(value: string | null | undefined): string {
    return value ? dateTimeFormat.format(new Date(value)) : '—';
}

export function formatNumber(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : numberFormat.format(value);
}

export function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined) return '—';
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function timeAgo(value: string | null | undefined): string {
    if (!value) return 'jamais';
    const diff = (new Date(value).getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);
    if (abs < 60) return 'à l’instant';
    if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return relative.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return relative.format(Math.round(diff / 86400), 'day');
    return formatDate(value);
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['fr'], { type: 'region' }) : null;

export function countryName(code: string | null | undefined): string {
    if (!code) return 'Inconnu';
    try {
        return regionNames?.of(code) ?? code;
    } catch {
        return code;
    }
}

/** Drapeau emoji à partir du code pays ISO (affichage seulement). */
export function countryFlag(code: string | null | undefined): string {
    if (!code || !/^[A-Z]{2}$/.test(code)) return '🏳️';
    return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}
