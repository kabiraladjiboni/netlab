import type { ProtocolStatus } from '@/types/content';

export const statusLabels: Record<ProtocolStatus, { label: string; description: string; className: string }> = {
    standard: { label: 'Standard ouvert', description: 'Normalisé par un organisme (IETF, IEEE, ISO, OASIS…).', className: 'border-ok/40 text-ok' },
    extension: { label: 'Extension', description: 'Complète un protocole existant.', className: 'border-signal/40 text-signal' },
    mechanism: { label: 'Mécanisme', description: 'Fonctionnement ou technique, pas un protocole échangé entre machines.', className: 'border-layer-transport/40 text-layer-transport' },
    tool: { label: 'Outil', description: 'Outil de diagnostic qui s’appuie sur d’autres protocoles.', className: 'border-layer-link/40 text-layer-link' },
    proprietary: { label: 'Propriétaire', description: 'Défini par un éditeur ou un constructeur.', className: 'border-warn/40 text-warn' },
    certification: { label: 'Certification', description: 'Programme de certification fondé sur des normes.', className: 'border-violet/40 text-violet' },
    'open-source': { label: 'Projet ouvert', description: 'Protocole ouvert issu d’un projet libre, non normalisé à l’IETF.', className: 'border-layer-app/40 text-layer-app' },
};

export const OSI_NAMES = ['Physique', 'Liaison', 'Réseau', 'Transport', 'Session', 'Présentation', 'Application'];
export const TCPIP_NAMES = ['Accès réseau', 'Internet', 'Transport', 'Application'];

/** Couleur de couche (OSI 1 à 7). */
export const osiLayerColor = (n: number) =>
    n >= 5 ? 'bg-layer-app' : n === 4 ? 'bg-layer-transport' : n === 3 ? 'bg-layer-network' : n === 2 ? 'bg-layer-link' : 'bg-layer-physical';
export const tcpipLayerColor = (n: number) => (n === 4 ? 'bg-layer-app' : n === 3 ? 'bg-layer-transport' : n === 2 ? 'bg-layer-network' : 'bg-layer-link');
