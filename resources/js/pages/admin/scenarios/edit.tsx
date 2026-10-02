import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Copy, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScenarioPlayer } from '@/components/engine/scenario-player';
import { AdminPage, ConfirmButton, Panel, StatusPill } from '@/components/admin/ui';
import { FormErrors, inputClass, TextArea, TextField } from '@/components/forms/fields';
import { validateScenario } from '@/engine/validate';
import type { Scenario } from '@/engine/types';
import { getScenarioVariants, scenarioRegistry } from '@/scenarios';

type Props = { scenario: { id: number; key: string; title: string; description: string | null; source: 'builtin' | 'custom'; definition: Scenario | null; status: string; validated_at: string | null } | null };

const TEMPLATE: Scenario = {
    id: 'mon-scenario',
    title: 'Mon scénario',
    summary: 'Un ordinateur interroge un serveur.',
    assumptions: ['Adresses de documentation (RFC 5737).'],
    viewBox: { w: 800, h: 360 },
    nodes: [
        { id: 'pc', kind: 'laptop', label: 'Ordinateur', sublabel: '192.0.2.10', x: 140, y: 180, description: 'Le poste de l’étudiant.' },
        { id: 'srv', kind: 'server', label: 'Serveur', sublabel: '198.51.100.20', x: 660, y: 180, description: 'Le serveur interrogé.' },
    ],
    links: [{ from: 'pc', to: 'srv', medium: 'wan' }],
    packets: {},
    steps: [
        { id: 'question', title: 'La question part', text: { 1: 'L’ordinateur envoie une demande au serveur.' }, focus: ['pc', 'srv'], packets: [{ id: 'q', label: 'Demande', tone: 'request', path: ['pc', 'srv'] }] },
        { id: 'reponse', title: 'La réponse revient', text: { 1: 'Le serveur répond.' }, focus: ['srv', 'pc'], packets: [{ id: 'r', label: 'Réponse', tone: 'response', path: ['srv', 'pc'] }], status: 'ok' },
    ],
};

/**
 * Éditeur de scénario : JSON validé en direct (mêmes règles que le serveur),
 * aperçu joué par le moteur réel, édition rapide des titres et textes d'étapes.
 */
export default function ScenarioEdit({ scenario }: Props) {
    const builtin = scenario?.source === 'builtin';
    const builtinVariants = builtin ? getScenarioVariants(scenario.key) : null;
    const form = useForm({
        key: scenario?.key ?? '',
        title: scenario?.title ?? '',
        description: scenario?.description ?? '',
        definition: JSON.stringify(scenario?.definition ?? TEMPLATE, null, 2),
    });
    const [copyFrom, setCopyFrom] = useState('');

    const parsed = useMemo(() => {
        try {
            const value = JSON.parse(form.data.definition) as Scenario;
            const errors = validateStructure(value);
            return { value, errors: errors.length ? errors : validateScenario(value) };
        } catch (error) {
            return { value: null, errors: [`JSON invalide : ${(error as Error).message}`] };
        }
    }, [form.data.definition]);

    const preview = builtin ? builtinVariants?.[0]?.scenario ?? null : parsed.errors.length === 0 ? parsed.value : null;
    const setStep = (index: number, patch: { title?: string; text?: string }) => {
        if (!parsed.value) return;
        const next = structuredClone(parsed.value);
        const step = next.steps[index];
        if (patch.title !== undefined) step.title = patch.title;
        if (patch.text !== undefined) step.text = typeof step.text === 'string' ? patch.text : { ...step.text, 1: patch.text };
        form.setData('definition', JSON.stringify(next, null, 2));
    };

    return (
        <AdminPage
            title={scenario ? scenario.title : 'Nouveau scénario'}
            back={{ href: '/admin/scenarios', label: 'Scénarios' }}
            actions={
                scenario && (
                    <>
                        <StatusPill status={scenario.status} />
                        <button
                            type="button"
                            onClick={() => router.post(`/admin/scenarios/${scenario.id}/publication`, { status: scenario.status === 'published' ? 'draft' : 'published' }, { preserveScroll: true })}
                            className="rounded-xl border border-line px-3.5 py-2 text-sm font-medium hover:bg-night-800"
                        >
                            {scenario.status === 'published' ? 'Retirer de la publication' : 'Publier'}
                        </button>
                        {!builtin && (
                            <ConfirmButton title="Supprimer ce scénario ?" description="Impossible s’il est utilisé par un chapitre ou une fiche." onConfirm={() => router.delete(`/admin/scenarios/${scenario.id}`)} className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-3.5 py-2 text-sm text-danger hover:bg-danger/10">
                                <Trash2 className="size-4" aria-hidden /> Supprimer
                            </ConfirmButton>
                        )}
                    </>
                )
            }
        >
            <Head title={scenario ? `Scénario — ${scenario.title}` : 'Nouveau scénario'} />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (scenario) form.put(`/admin/scenarios/${scenario.id}`, { preserveScroll: true });
                    else form.post('/admin/scenarios');
                }}
                className="space-y-5"
                noValidate
            >
                <FormErrors errors={form.errors as Record<string, string>} />
                <Panel title="Informations">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <TextField label="Titre" required value={form.data.title} onChange={(v) => form.setData('title', v)} error={form.errors.title} />
                        <TextField label="Identifiant" required value={form.data.key} onChange={(v) => form.setData('key', v)} error={form.errors.key} disabled={builtin} />
                        <TextArea label="Description" rows={1} value={form.data.description} onChange={(v) => form.setData('description', v)} />
                    </div>
                </Panel>

                {builtin ? (
                    <Panel title="Scénario intégré" description="Sa définition se trouve dans resources/js/scenarios et est couverte par les tests automatiques. Ici, tu peux renommer le scénario et gérer sa publication.">
                        <p className="text-sm text-muted-foreground">{builtinVariants?.length ?? 0} situation(s) disponibles.</p>
                    </Panel>
                ) : (
                    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
                        <Panel
                            title="Définition (JSON)"
                            description="Nœuds, liens, paquets, étapes. Les erreurs s’affichent en direct ; un brouillon incomplet peut être enregistré, mais seul un scénario valide peut être publié."
                            actions={
                                <div className="flex items-center gap-1.5">
                                    <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={`${inputClass} w-auto py-1.5 text-xs`} aria-label="Partir d’un scénario intégré">
                                        <option value="">Partir d’un scénario intégré…</option>
                                        {Object.entries(scenarioRegistry).flatMap(([key, variants]) =>
                                            variants.map((variant) => (
                                                <option key={`${key}:${variant.id}`} value={`${key}:${variant.id}`}>
                                                    {key} — {variant.label}
                                                </option>
                                            )),
                                        )}
                                    </select>
                                    <button
                                        type="button"
                                        disabled={!copyFrom}
                                        onClick={() => {
                                            const [key, id] = copyFrom.split(':');
                                            const variant = scenarioRegistry[key]?.find((v) => v.id === id);
                                            if (variant && window.confirm('Remplacer la définition actuelle par une copie de ce scénario ?')) form.setData('definition', JSON.stringify(variant.scenario, null, 2));
                                        }}
                                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs disabled:opacity-40"
                                    >
                                        <Copy className="size-3.5" aria-hidden /> Copier
                                    </button>
                                </div>
                            }
                        >
                            <textarea value={form.data.definition} onChange={(e) => form.setData('definition', e.target.value)} spellCheck={false} rows={28} className={`${inputClass} font-mono text-[12px] leading-relaxed`} aria-label="Définition JSON du scénario" />
                            {parsed.errors.length === 0 ? (
                                <p className="mt-3 flex items-center gap-2 text-sm text-ok">
                                    <CheckCircle2 className="size-4" aria-hidden /> Scénario valide : {parsed.value?.steps.length} étapes, {parsed.value?.nodes.length} équipements.
                                </p>
                            ) : (
                                <div className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
                                    <p className="flex items-center gap-2 font-semibold text-warn">
                                        <TriangleAlert className="size-4" aria-hidden /> {parsed.errors.length} problème(s)
                                    </p>
                                    <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs scrollbar-thin">
                                        {parsed.errors.map((error) => (
                                            <li key={error}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Panel>
                        <div className="space-y-5">
                            {parsed.value && parsed.errors.length === 0 && (
                                <Panel title="Textes des étapes" description="Modification rapide du titre et du texte « Je découvre » de chaque étape.">
                                    <ol className="max-h-[22rem] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                                        {parsed.value.steps.map((step, index) => (
                                            <li key={step.id} className="space-y-1.5 rounded-xl border border-line p-2.5">
                                                <input value={step.title} onChange={(e) => setStep(index, { title: e.target.value })} className={`${inputClass} py-1.5 font-medium`} aria-label={`Titre de l’étape ${index + 1}`} />
                                                <textarea value={typeof step.text === 'string' ? step.text : step.text[1]} onChange={(e) => setStep(index, { text: e.target.value })} rows={2} className={`${inputClass} py-1.5 text-[13px]`} aria-label={`Texte de l’étape ${index + 1}`} />
                                            </li>
                                        ))}
                                    </ol>
                                </Panel>
                            )}
                        </div>
                    </div>
                )}

                {preview && (
                    <Panel title="Test du scénario" description="Joué par le moteur réel, exactement comme les étudiants le verront.">
                        <ScenarioPlayer key={form.data.definition.length} scenario={preview} contextTitle={form.data.title || 'Aperçu'} guide={false} />
                    </Panel>
                )}

                {!builtin && (
                    <div className="sticky bottom-3 z-20 flex items-center justify-end gap-3 rounded-2xl border border-line bg-popover/95 p-3 shadow-xl backdrop-blur">
                        <span className="mr-auto text-xs text-muted-foreground">{form.isDirty ? 'Modifications non enregistrées' : 'À jour'}</span>
                        <button type="submit" disabled={form.processing} className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60">
                            Enregistrer
                        </button>
                    </div>
                )}
                {builtin && (
                    <div className="flex justify-end">
                        <button type="submit" disabled={form.processing} className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60">
                            Enregistrer
                        </button>
                    </div>
                )}
            </form>
        </AdminPage>
    );
}

/** Contrôle de forme minimal avant la validation métier (évite les plantages sur un JSON incomplet). */
function validateStructure(value: Scenario): string[] {
    const errors: string[] = [];
    if (!value || typeof value !== 'object') return ['Le scénario doit être un objet.'];
    if (!Array.isArray(value.nodes)) errors.push('« nodes » doit être une liste.');
    if (!Array.isArray(value.links)) errors.push('« links » doit être une liste.');
    if (!Array.isArray(value.steps)) errors.push('« steps » doit être une liste.');
    if (!value.viewBox || typeof value.viewBox.w !== 'number' || typeof value.viewBox.h !== 'number') errors.push('« viewBox » doit contenir w et h.');
    if (typeof value.packets !== 'object' || value.packets === null || Array.isArray(value.packets)) errors.push('« packets » doit être un objet (éventuellement vide).');
    if (!Array.isArray(value.assumptions)) errors.push('« assumptions » doit être une liste.');
    if (errors.length === 0) {
        value.steps.forEach((step, index) => {
            if (!Array.isArray(step.focus) || !Array.isArray(step.packets)) errors.push(`Étape ${index + 1} : « focus » et « packets » doivent être des listes.`);
            step.packets?.forEach((packet) => {
                if (!Array.isArray(packet.path)) errors.push(`Étape ${index + 1} : le paquet ${packet.id} doit avoir un « path ».`);
            });
        });
    }
    return errors;
}
