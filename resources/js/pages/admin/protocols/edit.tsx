import { Head, router, useForm } from '@inertiajs/react';
import { Eye, Trash2 } from 'lucide-react';
import { MultiPick, RowsEditor, SaveBar, StringListEditor } from '@/components/admin/editors';
import { AdminPage, ConfirmButton, Panel } from '@/components/admin/ui';
import { FormErrors, SelectField, TextArea, TextField } from '@/components/forms/fields';

type Port = { number: string; transport: string; note?: string | null };
type Message = { from: string; to: string; message: string; note?: string | null };
type FieldRow = { name: string; size?: string | null; description: string };
type Reference = { label: string; url?: string | null };
type Related = { protocol_id: number | string; type: string; note?: string | null };
type Protocol = {
    id: number;
    slug: string;
    acronym: string;
    name: string;
    protocol_category_id: number;
    status: string;
    completeness: string;
    summary: string;
    problem: string;
    beginner: string;
    analogy: string;
    real_example: string | null;
    osi_note: string | null;
    tcpip_note: string | null;
    ports: Port[];
    communication: Message[];
    fields: FieldRow[];
    packet_example: { title: string; lines: string[]; note?: string | null } | null;
    mistakes: string[];
    limits: string[];
    variants: string[];
    references: Reference[];
    scenario_key: string | null;
    lesson_slug: string | null;
    status_publication: 'draft' | 'published';
    layers: number[];
    terms: number[];
    equipment: number[];
    related: Related[];
};
type Options = {
    categories: { id: number; name: string }[];
    statuses: Record<string, string>;
    layers: { id: number; model: string; number: number; name: string }[];
    terms: { id: number; term: string }[];
    equipment: { id: number; name: string }[];
    protocols: { id: number; acronym: string; name: string }[];
    relationTypes: Record<string, string>;
    scenarios: { key: string; title: string }[];
    lessons: { slug: string; title: string }[];
};

export default function ProtocolEdit({ protocol, options }: { protocol: Protocol | null; options: Options }) {
    const form = useForm({
        slug: protocol?.slug ?? '',
        acronym: protocol?.acronym ?? '',
        name: protocol?.name ?? '',
        protocol_category_id: protocol?.protocol_category_id ?? options.categories[0]?.id ?? '',
        status: protocol?.status ?? 'standard',
        completeness: protocol?.completeness ?? 'essential',
        summary: protocol?.summary ?? '',
        problem: protocol?.problem ?? '',
        beginner: protocol?.beginner ?? '',
        analogy: protocol?.analogy ?? '',
        real_example: protocol?.real_example ?? '',
        osi_note: protocol?.osi_note ?? '',
        tcpip_note: protocol?.tcpip_note ?? '',
        ports: (protocol?.ports ?? []) as Port[],
        communication: (protocol?.communication ?? []) as Message[],
        fields: (protocol?.fields ?? []) as FieldRow[],
        packet_title: protocol?.packet_example?.title ?? '',
        packet_lines: (protocol?.packet_example?.lines ?? []).join('\n'),
        packet_note: protocol?.packet_example?.note ?? '',
        mistakes: protocol?.mistakes ?? [],
        limits: protocol?.limits ?? [],
        variants: protocol?.variants ?? [],
        references: (protocol?.references ?? [{ label: '', url: '' }]) as Reference[],
        scenario_key: protocol?.scenario_key ?? '',
        lesson_slug: protocol?.lesson_slug ?? '',
        layers: protocol?.layers ?? [],
        terms: protocol?.terms ?? [],
        equipment: protocol?.equipment ?? [],
        related: (protocol?.related ?? []) as Related[],
        status_publication: protocol?.status_publication ?? 'draft',
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => {
            const lines = data.packet_lines.split('\n').map((line) => line.trimEnd()).filter(Boolean);
            const { packet_title, packet_lines: _lines, packet_note, ...rest } = data;
            return {
                ...rest,
                real_example: rest.real_example || null,
                osi_note: rest.osi_note || null,
                tcpip_note: rest.tcpip_note || null,
                scenario_key: rest.scenario_key || null,
                lesson_slug: rest.lesson_slug || null,
                references: rest.references.map((r) => ({ label: r.label, url: r.url || null })),
                related: rest.related.filter((r) => r.protocol_id).map((r) => ({ ...r, protocol_id: Number(r.protocol_id) })),
                packet_example: lines.length ? { title: packet_title || 'Exemple de capture', lines, note: packet_note || null } : null,
            };
        });
        if (protocol) form.put(`/admin/protocoles/${protocol.id}`, { preserveScroll: true });
        else form.post('/admin/protocoles');
    };

    const e = form.errors as Record<string, string>;
    const firstError = (prefix: string) => Object.entries(e).find(([key]) => key.startsWith(prefix))?.[1];

    return (
        <AdminPage
            title={protocol ? `${protocol.acronym} — ${protocol.name}` : 'Nouvelle fiche protocole'}
            back={{ href: '/admin/protocoles', label: 'Protocoles' }}
            description="N’invente jamais un port, un champ ou une caractéristique : chaque information doit pouvoir être vérifiée dans les références citées."
            actions={
                protocol && (
                    <>
                        <a href={`/protocoles/${protocol.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-night-800">
                            <Eye className="size-4" aria-hidden /> Prévisualiser
                        </a>
                        <ConfirmButton title="Supprimer cette fiche ?" description="Impossible si des étudiants l’ont en favori ou évaluée : dépublie-la plutôt." onConfirm={() => router.delete(`/admin/protocoles/${protocol.id}`)} className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-3.5 py-2 text-sm text-danger hover:bg-danger/10">
                            <Trash2 className="size-4" aria-hidden /> Supprimer
                        </ConfirmButton>
                    </>
                )
            }
        >
            <Head title={protocol ? `Fiche ${protocol.acronym}` : 'Nouvelle fiche'} />
            <form onSubmit={submit} className="space-y-5" noValidate>
                <FormErrors errors={e} />
                <Panel title="Identité">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <TextField label="Sigle" required value={form.data.acronym} onChange={(v) => form.setData('acronym', v)} error={e.acronym} />
                        <TextField label="Nom complet" required value={form.data.name} onChange={(v) => form.setData('name', v)} error={e.name} />
                        <TextField label="Identifiant (URL)" required value={form.data.slug} onChange={(v) => form.setData('slug', v)} error={e.slug} />
                        <SelectField label="Famille" value={form.data.protocol_category_id} onChange={(v) => form.setData('protocol_category_id', Number(v))} options={options.categories.map((c) => ({ value: c.id, label: c.name }))} error={e.protocol_category_id} />
                        <SelectField label="Nature" value={form.data.status} onChange={(v) => form.setData('status', v)} options={Object.entries(options.statuses).map(([value, label]) => ({ value, label }))} error={e.status} hint="Standard, extension, mécanisme, outil, propriétaire…" />
                        <SelectField label="Niveau de détail" value={form.data.completeness} onChange={(v) => form.setData('completeness', v)} options={[{ value: 'essential', label: 'Fiche essentielle' }, { value: 'complete', label: 'Fiche complète' }]} error={e.completeness} />
                    </div>
                </Panel>
                <Panel title="Explications (par niveau)">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <TextArea label="Résumé" required rows={2} value={form.data.summary} onChange={(v) => form.setData('summary', v)} error={e.summary} />
                        <TextArea label="Problème résolu" required rows={2} value={form.data.problem} onChange={(v) => form.setData('problem', v)} error={e.problem} />
                        <TextArea label="Explication débutant" required rows={4} value={form.data.beginner} onChange={(v) => form.setData('beginner', v)} error={e.beginner} />
                        <TextArea label="Analogie" required rows={4} value={form.data.analogy} onChange={(v) => form.setData('analogy', v)} error={e.analogy} />
                        <TextArea label="Exemple réel" rows={3} value={form.data.real_example} onChange={(v) => form.setData('real_example', v)} error={e.real_example} />
                        <div className="grid gap-4">
                            <TextArea label="Note modèle OSI" rows={2} value={form.data.osi_note} onChange={(v) => form.setData('osi_note', v)} />
                            <TextArea label="Note modèle TCP/IP" rows={2} value={form.data.tcpip_note} onChange={(v) => form.setData('tcpip_note', v)} />
                        </div>
                    </div>
                </Panel>
                <Panel title="Données techniques" description="Laisse vide plutôt que d’approximer.">
                    <div className="space-y-6">
                        <RowsEditor<Port> label="Ports" rows={form.data.ports} onChange={(v) => form.setData('ports', v)} empty={{ number: '', transport: '', note: '' }} columns={[{ key: 'number', label: 'Numéro', placeholder: '443' }, { key: 'transport', label: 'Transport', placeholder: 'TCP' }, { key: 'note', label: 'Remarque' }]} error={firstError('ports')} hint="Uniquement les ports normalisés (IANA). Aucun port pour un mécanisme qui n’en utilise pas." />
                        <RowsEditor<Message> label="Échanges (diagramme animé)" rows={form.data.communication} onChange={(v) => form.setData('communication', v)} empty={{ from: '', to: '', message: '', note: '' }} columns={[{ key: 'from', label: 'De' }, { key: 'to', label: 'Vers' }, { key: 'message', label: 'Message', type: 'textarea' }, { key: 'note', label: 'Note' }]} error={firstError('communication')} />
                        <RowsEditor<FieldRow> label="Champs importants" rows={form.data.fields} onChange={(v) => form.setData('fields', v)} empty={{ name: '', size: '', description: '' }} columns={[{ key: 'name', label: 'Champ' }, { key: 'size', label: 'Taille', placeholder: '16 bits' }, { key: 'description', label: 'Rôle', type: 'textarea' }]} error={firstError('fields')} />
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                            <div className="space-y-4">
                                <TextField label="Exemple de capture — titre" value={form.data.packet_title} onChange={(v) => form.setData('packet_title', v)} />
                                <TextArea label="Note sous l’exemple" rows={3} value={form.data.packet_note} onChange={(v) => form.setData('packet_note', v)} />
                            </div>
                            <TextArea label="Lignes de capture (une par ligne)" rows={7} mono value={form.data.packet_lines} onChange={(v) => form.setData('packet_lines', v)} error={firstError('packet_example')} hint="Adresses de documentation uniquement (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)." />
                        </div>
                    </div>
                </Panel>
                <Panel title="Pièges, limites et variantes">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <StringListEditor label="Erreurs fréquentes" items={form.data.mistakes} onChange={(v) => form.setData('mistakes', v)} multiline error={firstError('mistakes')} />
                        <StringListEditor label="Limites" items={form.data.limits} onChange={(v) => form.setData('limits', v)} multiline error={firstError('limits')} />
                        <StringListEditor label="Variantes et versions" items={form.data.variants} onChange={(v) => form.setData('variants', v)} error={firstError('variants')} />
                    </div>
                </Panel>
                <Panel title="Relations">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <MultiPick label="Couches" options={options.layers.map((l) => ({ value: l.id, label: `${l.number}. ${l.name}`, group: l.model === 'osi' ? 'OSI' : 'TCP/IP' }))} value={form.data.layers} onChange={(v) => form.setData('layers', v)} />
                        <MultiPick label="Termes techniques" options={options.terms.map((t) => ({ value: t.id, label: t.term }))} value={form.data.terms} onChange={(v) => form.setData('terms', v)} />
                        <MultiPick label="Équipements" options={options.equipment.map((q) => ({ value: q.id, label: q.name }))} value={form.data.equipment} onChange={(v) => form.setData('equipment', v)} />
                    </div>
                    <div className="mt-6">
                        <RowsEditor<Related>
                            label="Protocoles liés"
                            rows={form.data.related}
                            onChange={(v) => form.setData('related', v)}
                            empty={{ protocol_id: '', type: 'related', note: '' }}
                            columns={[
                                { key: 'protocol_id', label: 'Protocole', type: 'select', options: options.protocols.filter((p) => p.id !== protocol?.id).map((p) => ({ value: String(p.id), label: `${p.acronym} — ${p.name}` })) },
                                { key: 'type', label: 'Relation', type: 'select', options: Object.entries(options.relationTypes).map(([value, label]) => ({ value, label })) },
                                { key: 'note', label: 'Précision' },
                            ]}
                            error={firstError('related')}
                            hint="La relation inverse est ajoutée automatiquement sur l’autre fiche si elle n’existe pas."
                        />
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <SelectField label="Scénario animé (facultatif)" value={form.data.scenario_key} onChange={(v) => form.setData('scenario_key', v)} placeholder="Aucun" options={options.scenarios.map((s) => ({ value: s.key, label: s.title }))} />
                        <SelectField label="Leçon associée (facultatif)" value={form.data.lesson_slug} onChange={(v) => form.setData('lesson_slug', v)} placeholder="Aucune" options={options.lessons.map((l) => ({ value: l.slug, label: l.title }))} />
                    </div>
                </Panel>
                <Panel title="Références" description="Au moins une source vérifiable : RFC, norme IEEE, documentation officielle.">
                    <RowsEditor<Reference> label="Sources" rows={form.data.references} onChange={(v) => form.setData('references', v)} empty={{ label: '', url: '' }} columns={[{ key: 'label', label: 'Libellé', placeholder: 'RFC 9293 — TCP' }, { key: 'url', label: 'Lien', placeholder: 'https://www.rfc-editor.org/rfc/rfc9293' }]} error={firstError('references')} />
                </Panel>
                <SaveBar status={form.data.status_publication} onStatus={(s) => form.setData('status_publication', s)} processing={form.processing} dirty={form.isDirty} />
            </form>
        </AdminPage>
    );
}
