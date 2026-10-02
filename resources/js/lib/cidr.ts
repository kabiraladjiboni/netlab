/** Calculs IPv4 (CIDR) utilisés par le calculateur de sous-réseaux. */

export function parseIPv4(value: string): number | null {
    const parts = value.trim().split('.');
    if (parts.length !== 4) return null;
    let result = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const n = Number(part);
        if (n > 255) return null;
        result = result * 256 + n;
    }
    return result >>> 0;
}

export function formatIPv4(value: number): string {
    return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

export function prefixToMask(prefix: number): number {
    if (prefix <= 0) return 0;
    return (0xffffffff << (32 - prefix)) >>> 0;
}

export function toBinary(value: number): string {
    return value.toString(2).padStart(32, '0');
}

export type SubnetInfo = {
    address: string;
    prefix: number;
    mask: string;
    network: string;
    broadcast: string | null;
    firstHost: string;
    lastHost: string;
    total: number;
    usable: number;
    binary: string;
};

export function subnetInfo(ip: string, prefix: number): SubnetInfo | null {
    const address = parseIPv4(ip);
    if (address === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
    const mask = prefixToMask(prefix);
    const network = (address & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - prefix);
    let first = network + 1;
    let last = broadcast - 1;
    let usable = total - 2;
    if (prefix === 32) {
        first = last = network;
        usable = 1;
    } else if (prefix === 31) {
        // RFC 3021 : liens point à point, les deux adresses sont utilisables.
        first = network;
        last = broadcast;
        usable = 2;
    }
    return {
        address: formatIPv4(address),
        prefix,
        mask: formatIPv4(mask),
        network: formatIPv4(network),
        broadcast: prefix >= 31 ? null : formatIPv4(broadcast),
        firstHost: formatIPv4(first >>> 0),
        lastHost: formatIPv4(last >>> 0),
        total,
        usable,
        binary: toBinary(address),
    };
}

export function sameSubnet(a: string, b: string, prefix: number): boolean | null {
    const x = parseIPv4(a);
    const y = parseIPv4(b);
    if (x === null || y === null) return null;
    const mask = prefixToMask(prefix);
    return ((x & mask) >>> 0) === ((y & mask) >>> 0);
}

/** Catégorie pédagogique d'une adresse (plages réservées les plus courantes). */
export function addressKind(ip: string): string | null {
    const v = parseIPv4(ip);
    if (v === null) return null;
    const inRange = (base: string, prefix: number) => ((v & prefixToMask(prefix)) >>> 0) === parseIPv4(base);
    if (inRange('10.0.0.0', 8) || inRange('172.16.0.0', 12) || inRange('192.168.0.0', 16)) return 'privée (RFC 1918)';
    if (inRange('127.0.0.0', 8)) return 'bouclage (loopback)';
    if (inRange('169.254.0.0', 16)) return 'lien-local (autoconfiguration)';
    if (inRange('100.64.0.0', 10)) return 'espace partagé CGNAT (RFC 6598)';
    if (inRange('192.0.2.0', 24) || inRange('198.51.100.0', 24) || inRange('203.0.113.0', 24)) return 'documentation (RFC 5737)';
    if (inRange('224.0.0.0', 4)) return 'multicast';
    return 'publique (routable sur Internet)';
}
