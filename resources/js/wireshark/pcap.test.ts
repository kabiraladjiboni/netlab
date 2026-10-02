import { describe, expect, it } from 'vitest';
import { parseCapture, PcapError } from './pcap';

const bytes = (...parts: (number[] | Uint8Array)[]) => Uint8Array.from(parts.flatMap((p) => Array.from(p)));
const u16 = (v: number) => [(v >> 8) & 255, v & 255];
const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const le32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
const le16 = (v: number) => [v & 255, (v >> 8) & 255];
const ip = (s: string) => s.split('.').map(Number);
const macA = [0, 0, 0x5e, 0, 0x53, 0x0a];
const macB = [0, 0, 0x5e, 0, 0x53, 0x01];

function ipv4(proto: number, src: string, dst: string, payload: Uint8Array) {
    return bytes([0x45, 0, ...u16(20 + payload.length), 0, 0, 0x40, 0, 64, proto, 0, 0, ...ip(src), ...ip(dst)], payload);
}
const eth = (type: number, payload: Uint8Array) => bytes(macB, macA, u16(type), payload);

function dnsQuery() {
    const qname = bytes([3, ...'www'.split('').map((c) => c.charCodeAt(0)), 7, ...'example'.split('').map((c) => c.charCodeAt(0)), 3, ...'com'.split('').map((c) => c.charCodeAt(0)), 0]);
    const dns = bytes([0x3f, 0x2a, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0], qname, [0, 1, 0, 1]);
    const udp = bytes(u16(53112), u16(53), u16(8 + dns.length), [0, 0], dns);
    return eth(0x0800, ipv4(17, '192.168.1.10', '192.0.2.53', udp));
}

function syn() {
    const tcp = bytes(u16(51514), u16(443), u32(2817394562), u32(0), [0x50, 0x02], u16(64240), [0, 0, 0, 0]);
    return eth(0x0800, ipv4(6, '192.168.1.10', '198.51.100.20', tcp));
}

function pcapFile(frames: Uint8Array[]) {
    const header = bytes(le32(0xa1b2c3d4), le16(2), le16(4), le32(0), le32(0), le32(65535), le32(1));
    const records = frames.map((frame, i) => bytes(le32(1700000000 + i), le32(250000 * i), le32(frame.length), le32(frame.length), frame));
    return bytes(header, ...records).buffer;
}

describe('analyse PCAP', () => {
    it('décode Ethernet, IPv4, UDP/DNS et TCP, et repère une retransmission', () => {
        const result = parseCapture(pcapFile([dnsQuery(), syn(), syn()]));
        expect(result.format).toBe('pcap');
        expect(result.packets).toHaveLength(3);
        const [dns, first, second] = result.packets;
        expect(dns.protocol).toBe('DNS');
        expect(dns.fields['dns.qry.name']).toEqual(['www.example.com']);
        expect(dns.src).toBe('192.168.1.10');
        expect(first.protocol).toBe('TCP');
        expect(first.info).toContain('51514 → 443 [SYN]');
        expect(first.fields['tcp.seq']).toEqual([0]);
        expect(first.time).toBeCloseTo(1.25, 5);
        expect(second.fields['tcp.analysis.retransmission']).toEqual([true]);
    });

    it('décode un fichier PCAPNG', () => {
        const arp = eth(0x0806, bytes([0, 1, 8, 0, 6, 4, 0, 1], macA, ip('192.168.1.10'), [0, 0, 0, 0, 0, 0], ip('192.168.1.1')));
        const pad = (b: Uint8Array) => bytes(b, new Array((4 - (b.length % 4)) % 4).fill(0));
        const shbBody = bytes(le32(0x1a2b3c4d), le16(1), le16(0), le32(0xffffffff), le32(0xffffffff));
        const shb = bytes(le32(0x0a0d0d0a), le32(12 + shbBody.length), shbBody, le32(12 + shbBody.length));
        const idbBody = bytes(le16(1), le16(0), le32(65535));
        const idb = bytes(le32(1), le32(12 + idbBody.length), idbBody, le32(12 + idbBody.length));
        const epbBody = bytes(le32(0), le32(0), le32(1000000), le32(arp.length), le32(arp.length), pad(arp));
        const epb = bytes(le32(6), le32(12 + epbBody.length), epbBody, le32(12 + epbBody.length));
        const result = parseCapture(bytes(shb, idb, epb).buffer);
        expect(result.format).toBe('pcapng');
        expect(result.packets[0].protocol).toBe('ARP');
        expect(result.packets[0].info).toBe('Who has 192.168.1.1? Tell 192.168.1.10');
    });

    it('refuse les fichiers invalides', () => {
        expect(() => parseCapture(new Uint8Array(100).buffer)).toThrow(PcapError);
        expect(() => parseCapture(new Uint8Array(10).buffer)).toThrow(PcapError);
    });
});
