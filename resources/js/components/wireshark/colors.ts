import type { RowColor } from '@/wireshark/types';

/** Couleurs de lignes inspirées des règles par défaut de Wireshark, adaptées au thème sombre. */
export const rowColor: Record<RowColor, string> = {
    tcp: 'bg-[color-mix(in_oklab,var(--color-violet)_14%,transparent)]',
    syn: 'bg-[color-mix(in_oklab,var(--color-layer-physical)_26%,transparent)]',
    rst: 'bg-[color-mix(in_oklab,var(--color-danger)_30%,transparent)]',
    bad: 'bg-[var(--row-bad-bg)] text-[var(--row-bad-fg)]',
    dns: 'bg-[color-mix(in_oklab,var(--color-signal)_20%,transparent)]',
    udp: 'bg-[color-mix(in_oklab,var(--color-signal)_13%,transparent)]',
    arp: 'bg-[color-mix(in_oklab,var(--color-layer-link)_22%,transparent)]',
    icmp: 'bg-[color-mix(in_oklab,var(--color-layer-app)_16%,transparent)]',
    tls: 'bg-[color-mix(in_oklab,var(--color-electric)_15%,transparent)]',
    http: 'bg-[color-mix(in_oklab,var(--color-ok)_20%,transparent)]',
    dhcp: 'bg-[color-mix(in_oklab,var(--color-signal)_20%,transparent)]',
    quic: 'bg-[color-mix(in_oklab,var(--color-electric)_15%,transparent)]',
    other: '',
};

export const legend: { color: RowColor; label: string }[] = [
    { color: 'tcp', label: 'TCP' },
    { color: 'syn', label: 'TCP SYN / FIN' },
    { color: 'rst', label: 'TCP RST' },
    { color: 'bad', label: 'Problème TCP' },
    { color: 'udp', label: 'UDP / DNS' },
    { color: 'arp', label: 'ARP' },
    { color: 'icmp', label: 'ICMP' },
    { color: 'http', label: 'HTTP' },
    { color: 'tls', label: 'TLS / QUIC' },
];
