import type { Scenario, ScenarioVariant } from '@/engine/types';
import { dnsVariants } from './dns';
import { internetVariants } from './internet';
import { arpVariants, dhcpVariants, tlsVariants, traceVariants, vlanVariants } from './local';
import { natVariants } from './nat';
import { tcpVariants } from './tcp';

/**
 * Registre des scénarios animés. La clé correspond au champ `scenario_key`
 * des leçons et des fiches protocoles stockées en base de données.
 */
export const scenarioRegistry: Record<string, ScenarioVariant[]> = {
    'acces-internet': internetVariants,
    'nat-pat': natVariants,
    dns: dnsVariants,
    'tcp-handshake': tcpVariants,
    arp: arpVariants,
    dhcp: dhcpVariants,
    tls: tlsVariants,
    vlan: vlanVariants,
    traceroute: traceVariants,
};

export function getScenarioVariants(key: string | null | undefined): ScenarioVariant[] | null {
    if (!key) return null;
    return scenarioRegistry[key] ?? null;
}

/**
 * Variantes d'un scénario : intégré (registre) ou personnalisé (définition
 * JSON validée, fournie par le serveur).
 */
export function resolveVariants(key: string | null | undefined, custom: Scenario | null | undefined): ScenarioVariant[] {
    if (custom) {
        return [{ id: 'principal', label: custom.title, description: custom.summary, scenario: custom }];
    }
    return getScenarioVariants(key) ?? [];
}
