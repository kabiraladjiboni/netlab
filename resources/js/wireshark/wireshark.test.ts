import { describe, expect, it } from 'vitest';
import { captures } from './captures';
import { compileFilter } from './filter';
import type { CapturePacket } from './types';

const visit = captures.find((c) => c.id === 'visite-https')!;
const diag = captures.find((c) => c.id === 'diagnostic')!;

function apply(filter: string, packets: CapturePacket[]): number[] {
    const result = compileFilter(filter);
    if (!result.ok) throw new Error(result.error);
    return packets.filter(result.match).map((p) => p.no);
}

describe('moteur de filtres', () => {
    it('filtre par protocole', () => {
        expect(apply('dns', visit.packets)).toEqual([3, 4]);
        expect(apply('arp', visit.packets)).toEqual([1, 2]);
        expect(apply('tls', visit.packets)).toEqual([8, 9, 10, 12, 13, 14, 15]);
    });

    it('compare des champs, avec synonymes et logique booléenne', () => {
        expect(apply('tcp.flags.syn == 1', visit.packets)).toEqual([5, 6]);
        expect(apply('tcp.flags.syn eq 1 and tcp.flags.ack == 0', visit.packets)).toEqual([5]);
        expect(apply('udp.port == 53 || arp', visit.packets)).toEqual([1, 2, 3, 4]);
        expect(apply('!(tcp) && ip', visit.packets)).toEqual([3, 4]);
        expect(apply('tcp.len > 1000', visit.packets)).toEqual([9, 14, 15]);
    });

    it('gère ip.addr dans les deux sens et les préfixes CIDR', () => {
        expect(apply('ip.addr == 198.51.100.20', visit.packets)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        expect(apply('ip.src == 192.168.1.0/24 && udp', visit.packets)).toEqual([3]);
    });

    it('applique la sémantique « != » de Wireshark 3.6+', () => {
        expect(apply('ip.addr != 198.51.100.20 && ip', visit.packets)).toEqual([3, 4]);
    });

    it('cherche dans les chaînes et les champs d’analyse', () => {
        expect(apply('tls.handshake.extensions_server_name contains "example"', visit.packets)).toEqual([8]);
        expect(apply('tcp.analysis.retransmission', diag.packets)).toEqual([6, 7]);
        expect(apply('tcp.flags.reset == 1', diag.packets)).toEqual([9]);
    });

    it('signale clairement les erreurs', () => {
        const unknown = compileFilter('http2.header');
        expect(unknown.ok).toBe(false);
        expect(compileFilter('tcp.port ==').ok).toBe(false);
        expect(compileFilter('(dns').ok).toBe(false);
        expect(compileFilter('').ok).toBe(true);
    });
});

describe('captures pédagogiques', () => {
    it('les numéros et le temps sont croissants', () => {
        for (const capture of captures) {
            capture.packets.forEach((packet, index) => {
                expect(packet.no).toBe(index + 1);
                if (index > 0) expect(packet.time).toBeGreaterThanOrEqual(capture.packets[index - 1].time);
            });
        }
    });

    it('les longueurs de trames sont cohérentes', () => {
        const byNo = (n: number) => visit.packets[n - 1];
        expect(byNo(1).length).toBe(42);
        expect(byNo(3).length).toBe(75);
        expect(byNo(4).length).toBe(91);
        expect(byNo(5).length).toBe(74);
        expect(byNo(7).length).toBe(66);
        expect(byNo(14).length).toBe(1514);
    });

    it('les acquittements TCP correspondent aux données reçues', () => {
        const seq = (n: number) => visit.packets[n - 1].fields['tcp.seq'][0] as number;
        const ack = (n: number) => visit.packets[n - 1].fields['tcp.ack'][0] as number;
        const len = (n: number) => visit.packets[n - 1].fields['tcp.len'][0] as number;
        expect(ack(11)).toBe(seq(10) + len(10));
        expect(seq(13)).toBe(seq(12) + len(12));
        expect(ack(16)).toBe(seq(15) + len(15));
    });

    it('chaque mission a une réponse qui existe dans la capture', () => {
        for (const capture of captures) {
            const numbers = capture.packets.map((p) => p.no);
            for (const mission of capture.missions) {
                for (const n of mission.answer) expect(numbers).toContain(n);
            }
        }
    });

    it('les missions de filtre sont réalisables avec un filtre simple', () => {
        const solutions: Record<string, string> = {
            m3: 'dns',
            m4: 'tcp.flags.syn == 1',
            m6: 'ip.addr == 198.51.100.20',
            h2: 'http',
            d1: 'tcp.analysis.retransmission',
            d3: 'icmp',
            p1: 'dhcp',
        };
        for (const capture of captures) {
            for (const mission of capture.missions.filter((m) => m.kind === 'filter')) {
                expect(apply(solutions[mission.id], capture.packets), mission.id).toEqual(mission.answer);
            }
        }
    });
});
