import { Head, router, useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { MultiPick, SaveBar } from '@/components/admin/editors';
import { AdminPage, ConfirmButton, Panel } from '@/components/admin/ui';
import { FormErrors, TextArea, TextField } from '@/components/forms/fields';

type Term = { id: number; slug: string; term: string; category: string | null; simple: string; technical: string; example: string | null; aliases: string; related: number[]; status_publication: 'draft' | 'published' };

export default function TermEdit({ term, options }: { term: Term | null; options: { terms: { id: number; term: string }[]; categories: string[] } }) {
    const form = useForm({
        slug: term?.slug ?? '',
        term: term?.term ?? '',
        category: term?.category ?? '',
        simple: term?.simple ?? '',
        technical: term?.technical ?? '',
        example: term?.example ?? '',
        aliases: term?.aliases ?? '',
        related: term?.related ?? [],
        status_publication: term?.status_publication ?? 'draft',
    });
    return (
        <AdminPage
            title={term ? term.term : 'Nouveau terme'}
            back={{ href: '/admin/glossaire', label: 'Glossaire' }}
            actions={
                term && (
                    <ConfirmButton title="Supprimer ce terme ?" description="Impossible s’il est utilisé par une fiche ou une leçon." onConfirm={() => router.delete(`/admin/glossaire/${term.id}`)} className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-3.5 py-2 text-sm text-danger hover:bg-danger/10">
                        <Trash2 className="size-4" aria-hidden /> Supprimer
                    </ConfirmButton>
                )
            }
        >
            <Head title={term ? `Terme — ${term.term}` : 'Nouveau terme'} />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (term) form.put(`/admin/glossaire/${term.id}`, { preserveScroll: true });
                    else form.post('/admin/glossaire');
                }}
                className="space-y-5"
                noValidate
            >
                <FormErrors errors={form.errors} />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <Panel title="Définition">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <TextField label="Terme" required value={form.data.term} onChange={(v) => form.setData('term', v)} error={form.errors.term} />
                                <TextField label="Identifiant" required value={form.data.slug} onChange={(v) => form.setData('slug', v)} error={form.errors.slug} hint="Utilisé dans [[identifiant|libellé]]" />
                            </div>
                            <TextField label="Catégorie" value={form.data.category} onChange={(v) => form.setData('category', v)} list="categories" />
                            <datalist id="categories">
                                {options.categories.map((c) => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                            <TextArea label="Définition simple (niveau 1)" required rows={3} value={form.data.simple} onChange={(v) => form.setData('simple', v)} error={form.errors.simple} />
                            <TextArea label="Définition technique (niveaux 2–3)" required rows={4} value={form.data.technical} onChange={(v) => form.setData('technical', v)} error={form.errors.technical} />
                            <TextArea label="Exemple" rows={2} value={form.data.example} onChange={(v) => form.setData('example', v)} />
                            <TextArea label="Autres noms (un par ligne)" rows={3} value={form.data.aliases} onChange={(v) => form.setData('aliases', v)} hint="Améliore la recherche (ex. « commutateur » pour « switch »)." />
                        </div>
                    </Panel>
                    <Panel title="Termes liés">
                        <MultiPick label="Voir aussi" options={options.terms.filter((t) => t.id !== term?.id).map((t) => ({ value: t.id, label: t.term }))} value={form.data.related} onChange={(v) => form.setData('related', v)} height="max-h-96" />
                    </Panel>
                </div>
                <SaveBar status={form.data.status_publication} onStatus={(s) => form.setData('status_publication', s)} processing={form.processing} dirty={form.isDirty} />
            </form>
        </AdminPage>
    );
}
