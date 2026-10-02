import type { Scenario } from './types';

/**
 * Vérifie la cohérence structurelle d'un scénario. Utilisé par les tests
 * automatisés : un paquet ne peut pas emprunter un lien qui n'existe pas,
 * une étape ne peut pas référencer un équipement absent, etc.
 */
export function validateScenario(scenario: Scenario): string[] {
    const errors: string[] = [];
    const nodeIds = new Set<string>();
    for (const node of scenario.nodes) {
        if (nodeIds.has(node.id)) errors.push(`Nœud dupliqué : ${node.id}`);
        nodeIds.add(node.id);
        if (node.x < 0 || node.x > scenario.viewBox.w || node.y < 0 || node.y > scenario.viewBox.h) {
            errors.push(`Nœud hors scène : ${node.id}`);
        }
    }

    const linkKey = (a: string, b: string) => [a, b].sort().join('↔');
    const links = new Set<string>();
    for (const link of scenario.links) {
        if (!nodeIds.has(link.from)) errors.push(`Lien vers un nœud inconnu : ${link.from}`);
        if (!nodeIds.has(link.to)) errors.push(`Lien vers un nœud inconnu : ${link.to}`);
        links.add(linkKey(link.from, link.to));
    }

    if (scenario.steps.length === 0) errors.push('Le scénario ne contient aucune étape.');
    const stepIds = new Set<string>();

    scenario.steps.forEach((step, index) => {
        const where = `étape ${index + 1} (${step.id})`;
        if (stepIds.has(step.id)) errors.push(`Identifiant d'étape dupliqué : ${step.id}`);
        stepIds.add(step.id);
        if (!step.title.trim()) errors.push(`${where} : titre vide`);
        const text = typeof step.text === 'string' ? step.text : step.text[1];
        if (!text?.trim()) errors.push(`${where} : texte vide`);
        for (const id of step.focus) {
            if (!nodeIds.has(id)) errors.push(`${where} : focus sur un nœud inconnu ${id}`);
        }
        if (step.details && !scenario.packets[step.details]) {
            errors.push(`${where} : détails de paquet inconnus ${step.details}`);
        }
        if (step.bubble && !nodeIds.has(step.bubble.node)) {
            errors.push(`${where} : bulle sur un nœud inconnu ${step.bubble.node}`);
        }
        const seen = new Set<string>();
        for (const packet of step.packets) {
            if (packet.path.length < 2) errors.push(`${where} : le paquet ${packet.id} n'a pas de trajet`);
            for (let i = 0; i < packet.path.length; i += 1) {
                if (!nodeIds.has(packet.path[i])) errors.push(`${where} : paquet ${packet.id} → nœud inconnu ${packet.path[i]}`);
                if (i > 0 && !links.has(linkKey(packet.path[i - 1], packet.path[i]))) {
                    errors.push(`${where} : paquet ${packet.id} emprunte un lien absent ${packet.path[i - 1]} → ${packet.path[i]}`);
                }
            }
            if (packet.after && !seen.has(packet.after)) {
                errors.push(`${where} : le paquet ${packet.id} attend ${packet.after}, qui n'est pas défini avant lui`);
            }
            if (packet.inspect && !scenario.packets[packet.inspect]) {
                errors.push(`${where} : le paquet ${packet.id} référence des détails inconnus ${packet.inspect}`);
            }
            seen.add(packet.id);
        }
    });

    for (const [id, details] of Object.entries(scenario.packets)) {
        if (details.id !== id) errors.push(`Détails de paquet mal indexés : ${id} ≠ ${details.id}`);
    }
    return errors;
}
