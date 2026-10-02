import { describe, expect, it } from 'vitest';
import { addressKind, parseIPv4, prefixToMask, formatIPv4, sameSubnet, subnetInfo } from './cidr';

describe('calculs CIDR', () => {
    it('analyse et formate une adresse', () => {
        expect(parseIPv4('192.168.1.10')).toBe(3232235786);
        expect(parseIPv4('256.1.1.1')).toBeNull();
        expect(parseIPv4('1.2.3')).toBeNull();
        expect(formatIPv4(3232235786)).toBe('192.168.1.10');
    });

    it('convertit un préfixe en masque', () => {
        expect(formatIPv4(prefixToMask(24))).toBe('255.255.255.0');
        expect(formatIPv4(prefixToMask(20))).toBe('255.255.240.0');
        expect(formatIPv4(prefixToMask(0))).toBe('0.0.0.0');
        expect(formatIPv4(prefixToMask(32))).toBe('255.255.255.255');
    });

    it('calcule un /24', () => {
        expect(subnetInfo('192.168.1.10', 24)).toMatchObject({ network: '192.168.1.0', broadcast: '192.168.1.255', firstHost: '192.168.1.1', lastHost: '192.168.1.254', usable: 254, total: 256 });
    });

    it('calcule un /26 et les cas /31 et /32', () => {
        expect(subnetInfo('10.20.20.130', 26)).toMatchObject({ network: '10.20.20.128', broadcast: '10.20.20.191', usable: 62 });
        expect(subnetInfo('203.0.113.6', 31)).toMatchObject({ network: '203.0.113.6', broadcast: null, usable: 2 });
        expect(subnetInfo('203.0.113.6', 32)).toMatchObject({ usable: 1, firstHost: '203.0.113.6' });
    });

    it('détermine si deux adresses partagent un sous-réseau', () => {
        expect(sameSubnet('192.168.1.10', '192.168.1.1', 24)).toBe(true);
        expect(sameSubnet('192.168.2.50', '192.168.1.1', 24)).toBe(false);
        expect(sameSubnet('192.168.2.50', '192.168.1.1', 16)).toBe(true);
    });

    it('reconnaît les plages réservées', () => {
        expect(addressKind('192.168.1.10')).toContain('privée');
        expect(addressKind('172.31.0.1')).toContain('privée');
        expect(addressKind('172.32.0.1')).toContain('publique');
        expect(addressKind('100.64.1.1')).toContain('CGNAT');
        expect(addressKind('203.0.113.25')).toContain('documentation');
    });
});
