import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeTimeline } from '@/engine/timeline';
import type { LevelText, Scenario } from '@/engine/types';
import { validateScenario } from '@/engine/validate';
import { architectures } from './architectures';
import { scenarioRegistry } from './index';

const terms = new Set(
    (JSON.parse(readFileSync(resolve(__dirname, '../../../database/content/terms.json'), 'utf8')) as { slug: string }[]).map((t) => t.slug),
);
const lessons = JSON.parse(readFileSync(resolve(__dirname, '../../../database/content/lessons.json'), 'utf8')) as { scenario_key: string | null }[];

const allScenarios: Scenario[] = [...Object.values(scenarioRegistry).flatMap((variants) => variants.map((v) => v.scenario)), ...architectures];

function texts(text: LevelText): string[] {
    return typeof text === 'string' ? [text] : [text[1], text[2] ?? '', text[3] ?? ''];
}

describe('scénarios pédagogiques', () => {
    it.each(allScenarios.map((s) => [s.id, s] as const))('%s est structurellement cohérent', (_, scenario) => {
        expect(validateScenario(scenario)).toEqual([]);
    });

    it('les identifiants de scénarios sont uniques', () => {
        const ids = allScenarios.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it.each(allScenarios.map((s) => [s.id, s] as const))('%s ne référence que des termes existants du dictionnaire', (_, scenario) => {
        const missing: string[] = [];
        for (const step of scenario.steps) {
            for (const slug of step.terms ?? []) if (!terms.has(slug)) missing.push(slug);
            for (const t of texts(step.text)) for (const m of t.matchAll(/\[\[([a-z0-9-]+)/g)) if (!terms.has(m[1])) missing.push(m[1]);
        }
        for (const node of scenario.nodes) if (node.term && !terms.has(node.term)) missing.push(node.term);
        expect(missing).toEqual([]);
    });

    it('chaque leçon animée possède un scénario enregistré', () => {
        for (const lesson of lessons) {
            if (lesson.scenario_key) expect(scenarioRegistry[lesson.scenario_key], lesson.scenario_key).toBeDefined();
        }
    });

    it('chaque scénario mentionne ses hypothèses', () => {
        for (const scenario of allScenarios) expect(scenario.assumptions.length).toBeGreaterThan(0);
    });

    it('les étapes ont une durée finie et des paquets ordonnés', () => {
        for (const scenario of allScenarios) {
            for (const step of scenario.steps) {
                const timeline = computeTimeline(step, 'texte');
                expect(Number.isFinite(timeline.duration)).toBe(true);
                for (const packet of timeline.packets) expect(packet.end).toBeGreaterThan(packet.start);
            }
        }
    });
});

describe('cohérence de la leçon principale', () => {
    const classic = scenarioRegistry['acces-internet'][0].scenario;

    it('la traduction NAT ne modifie que la source à l’aller', () => {
        const nat = classic.steps.find((s) => s.id === 'nat')!.transform!;
        const changed = nat.before.filter((b, i) => b.value !== nat.after[i].value).map((b) => b.label);
        expect(changed).toEqual(['IP source', 'Port source']);
    });

    it('le TTL diminue d’un saut à l’autre', () => {
        const ttl = (id: string) => Number(classic.packets[id].layers.find((l) => l.name === 'IPv4')!.fields.find((f) => f.name === 'TTL')!.value);
        expect([ttl('syn-lan'), ttl('syn-wan'), ttl('syn-internet'), ttl('syn-server')]).toEqual([64, 63, 61, 60]);
    });

    it('le paquet sur le réseau local porte l’adresse privée, puis l’adresse publique après NAT', () => {
        const src = (id: string) => classic.packets[id].layers.find((l) => l.name === 'IPv4')!.fields.find((f) => f.name === 'IP source')!.value;
        expect(src('syn-lan')).toBe('192.168.1.10');
        expect(src('syn-wan')).toBe('203.0.113.25');
    });
});
