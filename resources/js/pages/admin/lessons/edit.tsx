import { Head, router, useForm } from '@inertiajs/react';
import { Eye, Lock, Trash2 } from 'lucide-react';
import { MultiPick, SaveBar } from '@/components/admin/editors';
import { AdminPage, ConfirmButton, Panel } from '@/components/admin/ui';
import { Checkbox, FormErrors, SelectField, TextArea, TextField } from '@/components/forms/fields';

type Lesson = {
    id: number;
    slug: string;
    title: string;
    course_id: number | null;
    objective: string;
    duration: number;
    kind: 'scenario' | 'page';
    scenario_key: string | null;
    href: string;
    featured: boolean;
    concepts: string[];
    quiz_id: number | null;
    intro: string | null;
    references: string;
    protocols: number[];
    status_publication: 'draft' | 'published';
};
type Options = {
    courses: { id: number; title: string }[];
    scenarios: { key: string; title: string }[];
    quizzes: { id: number; slug: string; title: string }[];
    terms: { slug: string; term: string }[];
    protocols: { id: number; acronym: string; name: string }[];
};

export default function LessonEdit({ lesson, options, defaultCourse, locked }: { lesson: Lesson | null; options: Options; defaultCourse?: number | null; locked: boolean }) {
    const form = useForm({
        title: lesson?.title ?? '',
        slug: lesson?.slug ?? '',
        course_id: lesson?.course_id ?? defaultCourse ?? '',
        objective: lesson?.objective ?? '',
        duration: lesson?.duration ?? 10,
        kind: lesson?.kind ?? 'scenario',
        scenario_key: lesson?.scenario_key ?? '',
        href: lesson?.kind === 'page' ? lesson.href : '',
        featured: lesson?.featured ?? false,
        concepts: lesson?.concepts ?? [],
        quiz_id: lesson?.quiz_id ?? '',
        intro: lesson?.intro ?? '',
        references: lesson?.references ?? '',
        protocols: lesson?.protocols ?? [],
        status_publication: lesson?.status_publication ?? 'draft',
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, course_id: data.course_id || null, quiz_id: data.quiz_id || null, scenario_key: data.scenario_key || null, href: data.href || null }));
        if (lesson) form.put(`/admin/chapitres/${lesson.id}`, { preserveScroll: true });
        else form.post('/admin/chapitres');
    };

    return (
        <AdminPage
            title={lesson ? lesson.title : 'Nouveau chapitre'}
            back={{ href: '/admin/cours', label: 'Cours et chapitres' }}
            actions={
                lesson && (
                    <>
                        <a href={lesson.kind === 'scenario' ? `/lecons/${lesson.slug}` : lesson.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-night-800">
                            <Eye className="size-4" aria-hidden /> Prévisualiser
                        </a>
                        <ConfirmButton
                            title="Supprimer ce chapitre ?"
                            description="Impossible si des étudiants y ont déjà travaillé : dans ce cas, dépublie-le pour conserver leur historique."
                            onConfirm={() => router.delete(`/admin/chapitres/${lesson.id}`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-3.5 py-2 text-sm text-danger hover:bg-danger/10"
                        >
                            <Trash2 className="size-4" aria-hidden /> Supprimer
                        </ConfirmButton>
                    </>
                )
            }
        >
            <Head title={lesson ? `Chapitre — ${lesson.title}` : 'Nouveau chapitre'} />
            <form onSubmit={submit} className="space-y-5" noValidate>
                <FormErrors errors={form.errors} />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <div className="space-y-5">
                        <Panel title="Contenu">
                            <div className="space-y-4">
                                <TextField label="Titre" required value={form.data.title} onChange={(v) => form.setData('title', v)} error={form.errors.title} />
                                <TextField
                                    label="Identifiant (URL)"
                                    required
                                    value={form.data.slug}
                                    onChange={(v) => form.setData('slug', v)}
                                    error={form.errors.slug}
                                    disabled={locked}
                                    hint={locked ? <span className="inline-flex items-center gap-1"><Lock className="size-3" aria-hidden /> Verrouillé : des étudiants ont déjà une progression sur ce chapitre.</span> : 'Minuscules et tirets. Utilisé dans l’adresse /lecons/…'}
                                />
                                <TextArea label="Objectif" required rows={2} value={form.data.objective} onChange={(v) => form.setData('objective', v)} error={form.errors.objective} hint="Une phrase : ce que l’étudiant saura faire à la fin." />
                                <TextArea
                                    label="Introduction (facultatif)"
                                    rows={5}
                                    value={form.data.intro}
                                    onChange={(v) => form.setData('intro', v)}
                                    error={form.errors.intro}
                                    hint="Mise en forme : **gras**, `code`, [[slug-du-terme|libellé]] pour lier le dictionnaire, lignes commençant par « - » pour une liste."
                                />
                                <TextArea label="Références techniques" rows={3} mono value={form.data.references} onChange={(v) => form.setData('references', v)} error={form.errors.references} hint="Une par ligne : « Libellé | https://… » (ex. RFC 793 — TCP | https://www.rfc-editor.org/rfc/rfc793)." />
                            </div>
                        </Panel>
                        <Panel title="Notions et protocoles associés">
                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                <MultiPick label="Notions (termes du dictionnaire)" options={options.terms.map((t) => ({ value: t.slug, label: t.term }))} value={form.data.concepts} onChange={(v) => form.setData('concepts', v)} error={form.errors.concepts} />
                                <MultiPick label="Fiches protocoles" options={options.protocols.map((p) => ({ value: p.id, label: `${p.acronym} — ${p.name}` }))} value={form.data.protocols} onChange={(v) => form.setData('protocols', v)} error={form.errors.protocols} />
                            </div>
                        </Panel>
                    </div>
                    <div className="space-y-5">
                        <Panel title="Organisation">
                            <div className="space-y-4">
                                <SelectField label="Cours" value={form.data.course_id} onChange={(v) => form.setData('course_id', v ? Number(v) : '')} placeholder="Aucun cours" options={options.courses.map((c) => ({ value: c.id, label: c.title }))} error={form.errors.course_id} />
                                <SelectField label="Type de chapitre" value={form.data.kind} onChange={(v) => form.setData('kind', v as 'scenario' | 'page')} options={[{ value: 'scenario', label: 'TP animé (scénario)' }, { value: 'page', label: 'Page interactive existante' }]} />
                                {form.data.kind === 'scenario' ? (
                                    <SelectField label="Scénario animé" required value={form.data.scenario_key} onChange={(v) => form.setData('scenario_key', v)} placeholder="Choisir un scénario" options={options.scenarios.map((s) => ({ value: s.key, label: s.title }))} error={form.errors.scenario_key} hint="Les scénarios se gèrent dans « Scénarios animés »." />
                                ) : (
                                    <TextField label="Adresse de la page" required value={form.data.href} onChange={(v) => form.setData('href', v)} error={form.errors.href} placeholder="/modeles/osi" />
                                )}
                                <TextField label="Durée estimée (min)" type="number" min={1} max={600} value={form.data.duration} onChange={(v) => form.setData('duration', Number(v))} error={form.errors.duration} />
                                <SelectField label="Quiz de validation" value={form.data.quiz_id} onChange={(v) => form.setData('quiz_id', v ? Number(v) : '')} placeholder="Aucun quiz" options={options.quizzes.map((q) => ({ value: q.id, label: q.title }))} error={form.errors.quiz_id} />
                                <Checkbox label="Mettre en avant sur l’accueil" checked={form.data.featured} onChange={(v) => form.setData('featured', v)} />
                            </div>
                        </Panel>
                    </div>
                </div>
                <SaveBar status={form.data.status_publication} onStatus={(s) => form.setData('status_publication', s)} processing={form.processing} dirty={form.isDirty} />
            </form>
        </AdminPage>
    );
}
