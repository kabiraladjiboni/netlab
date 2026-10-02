import { Head, router, useForm } from '@inertiajs/react';
import { Eye, Trash2 } from 'lucide-react';
import { RowsEditor, SaveBar, StringListEditor } from '@/components/admin/editors';
import { AdminPage, ConfirmButton, Panel } from '@/components/admin/ui';
import { FormErrors, SelectField, TextArea, TextField } from '@/components/forms/fields';

type Observation = { kind: string; title: string; lines: string[] };
type Diagnostic = { id: number; slug: string; title: string; difficulty: string; summary: string; symptoms: string[]; observations: Observation[]; hints: string[]; choices: string[]; answer: number; explanation: string; related: { label: string; href: string }[]; status_publication: 'draft' | 'published' };
type ObservationRow = { kind: string; title: string; text: string };

export default function DiagnosticEdit({ diagnostic }: { diagnostic: Diagnostic | null }) {
    const form = useForm({
        slug: diagnostic?.slug ?? '',
        title: diagnostic?.title ?? '',
        difficulty: diagnostic?.difficulty ?? 'facile',
        summary: diagnostic?.summary ?? '',
        symptoms: diagnostic?.symptoms ?? [''],
        observations: (diagnostic?.observations ?? []).map((o) => ({ kind: o.kind, title: o.title, text: o.lines.join('\n') })) as ObservationRow[],
        hints: diagnostic?.hints ?? [''],
        choices: diagnostic?.choices ?? ['', ''],
        answer: diagnostic?.answer ?? 0,
        explanation: diagnostic?.explanation ?? '',
        related: diagnostic?.related ?? [],
        status_publication: diagnostic?.status_publication ?? 'draft',
    });
    const errors = form.errors as Record<string, string>;
    const first = (prefix: string) => Object.entries(errors).find(([key]) => key.startsWith(prefix))?.[1];

    return (
        <AdminPage
            title={diagnostic ? diagnostic.title : 'Nouvel exercice'}
            back={{ href: '/admin/diagnostics', label: 'Diagnostics' }}
            description="La bonne réponse et la correction ne sont jamais envoyées à l’étudiant avant qu’il trouve (ou après deux essais)."
            actions={
                diagnostic && (
                    <>
                        <a href={`/diagnostic/${diagnostic.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-night-800">
                            <Eye className="size-4" aria-hidden /> Tester
                        </a>
                        <ConfirmButton title="Supprimer cet exercice ?" description="Impossible si des étudiants y ont travaillé." onConfirm={() => router.delete(`/admin/diagnostics/${diagnostic.id}`)} className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-3.5 py-2 text-sm text-danger hover:bg-danger/10">
                            <Trash2 className="size-4" aria-hidden /> Supprimer
                        </ConfirmButton>
                    </>
                )
            }
        >
            <Head title={diagnostic ? `Diagnostic — ${diagnostic.title}` : 'Nouvel exercice'} />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.transform((data) => ({ ...data, observations: data.observations.map((o) => ({ kind: o.kind || 'note', title: o.title, lines: o.text.split('\n') })) }));
                    if (diagnostic) form.put(`/admin/diagnostics/${diagnostic.id}`, { preserveScroll: true });
                    else form.post('/admin/diagnostics');
                }}
                className="space-y-5"
                noValidate
            >
                <FormErrors errors={errors} />
                <Panel title="Situation">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <TextField label="Titre" required value={form.data.title} onChange={(v) => form.setData('title', v)} error={errors.title} />
                        <TextField label="Identifiant" required value={form.data.slug} onChange={(v) => form.setData('slug', v)} error={errors.slug} />
                        <SelectField label="Difficulté" value={form.data.difficulty} onChange={(v) => form.setData('difficulty', v)} options={[{ value: 'facile', label: 'Facile' }, { value: 'moyen', label: 'Moyen' }, { value: 'difficile', label: 'Difficile' }]} />
                        <TextArea className="md:col-span-3" label="Résumé" required rows={2} value={form.data.summary} onChange={(v) => form.setData('summary', v)} error={errors.summary} />
                    </div>
                    <div className="mt-5">
                        <StringListEditor label="Symptômes" items={form.data.symptoms} onChange={(v) => form.setData('symptoms', v)} error={first('symptoms')} min={1} />
                    </div>
                </Panel>
                <Panel title="Observations" description="Sorties de commandes, extraits de capture ou notes. Les visiteurs sans compte ne voient que la première.">
                    <RowsEditor<ObservationRow>
                        label="Éléments observés"
                        rows={form.data.observations}
                        onChange={(v) => form.setData('observations', v)}
                        empty={{ kind: 'command', title: '', text: '' }}
                        columns={[
                            { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'command', label: 'Commande' }, { value: 'capture', label: 'Capture' }, { value: 'note', label: 'Note' }] },
                            { key: 'title', label: 'Titre' },
                            { key: 'text', label: 'Contenu (une ligne par ligne affichée)', type: 'textarea' },
                        ]}
                        error={first('observations')}
                    />
                </Panel>
                <Panel title="Résolution">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <StringListEditor label="Indices progressifs (du plus vague au plus précis)" items={form.data.hints} onChange={(v) => form.setData('hints', v)} multiline error={first('hints')} min={1} />
                        <div className="space-y-3">
                            <StringListEditor label="Causes proposées" items={form.data.choices} onChange={(v) => form.setData('choices', v)} error={first('choices')} min={2} />
                            <SelectField label="Bonne réponse" value={form.data.answer} onChange={(v) => form.setData('answer', Number(v))} options={form.data.choices.map((choice, index) => ({ value: index, label: `${index + 1}. ${choice || '(vide)'}` }))} error={errors.answer} />
                        </div>
                    </div>
                    <div className="mt-5 space-y-5">
                        <TextArea label="Correction détaillée" required rows={5} value={form.data.explanation} onChange={(v) => form.setData('explanation', v)} error={errors.explanation} />
                        <RowsEditor<{ label: string; href: string }> label="Pour aller plus loin (liens internes)" rows={form.data.related} onChange={(v) => form.setData('related', v)} empty={{ label: '', href: '' }} columns={[{ key: 'label', label: 'Libellé' }, { key: 'href', label: 'Adresse', placeholder: '/lecons/dhcp' }]} error={first('related')} />
                    </div>
                </Panel>
                <SaveBar status={form.data.status_publication} onStatus={(s) => form.setData('status_publication', s)} processing={form.processing} dirty={form.isDirty} />
            </form>
        </AdminPage>
    );
}
