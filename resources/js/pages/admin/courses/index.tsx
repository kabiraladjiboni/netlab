import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Eye, FlaskConical, MonitorPlay, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AdminPage, ButtonLink, ConfirmButton, Panel, StatusPill } from '@/components/admin/ui';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms/fields';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Lesson = { id: number; slug: string; title: string; kind: string; status: string; scenario_key: string | null; quiz: string | null; href: string; lab_sessions: number };
type Course = { id: number; slug: string; title: string; description: string | null; level: string; status: string; sort: number; lessons: Lesson[] };

export default function CoursesIndex({ courses, orphans, levels }: { courses: Course[]; orphans: { id: number; slug: string; title: string; status_publication: string }[]; levels: Record<string, string> }) {
    const [editing, setEditing] = useState<Course | 'new' | null>(null);

    const reorder = (course: Course, from: number, to: number) => {
        if (to < 0 || to >= course.lessons.length) return;
        const ids = course.lessons.map((lesson) => lesson.id);
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        router.post(`/admin/cours/${course.id}/ordre`, { lessons: ids }, { preserveScroll: true });
    };

    return (
        <AdminPage
            title="Cours et chapitres"
            description="Un cours regroupe des chapitres dans un ordre précis. Un chapitre est soit un TP animé, soit une page interactive existante."
            actions={
                <>
                    <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold hover:bg-night-800">
                        <Plus className="size-4" aria-hidden /> Nouveau cours
                    </button>
                    <ButtonLink href="/admin/chapitres/nouveau">
                        <Plus className="size-4" aria-hidden /> Nouveau chapitre
                    </ButtonLink>
                </>
            }
        >
            <Head title="Cours" />
            {courses.map((course) => (
                <Panel
                    key={course.id}
                    padded={false}
                    title={
                        <span className="flex flex-wrap items-center gap-2">
                            {course.title} <StatusPill status={course.status} /> <span className="text-xs font-normal text-muted-foreground">{levels[course.level]}</span>
                        </span>
                    }
                    description={course.description}
                    actions={
                        <div className="flex gap-1">
                            <a href={`/cours/${course.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted-foreground hover:bg-night-800" aria-label="Prévisualiser le cours">
                                <Eye className="size-4" aria-hidden />
                            </a>
                            <button type="button" onClick={() => setEditing(course)} className="rounded-lg p-2 text-muted-foreground hover:bg-night-800" aria-label="Modifier le cours">
                                <Pencil className="size-4" aria-hidden />
                            </button>
                            {course.lessons.length === 0 && (
                                <ConfirmButton title="Supprimer ce cours ?" description="Le cours ne contient aucun chapitre." onConfirm={() => router.delete(`/admin/cours/${course.id}`, { preserveScroll: true })} className="rounded-lg p-2 text-muted-foreground hover:bg-danger/10 hover:text-danger">
                                    <Trash2 className="size-4" aria-label="Supprimer le cours" />
                                </ConfirmButton>
                            )}
                        </div>
                    }
                >
                    <ol className="divide-y divide-line/60">
                        {course.lessons.map((lesson, index) => (
                            <li key={lesson.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                                <span className="w-6 font-mono text-xs text-muted-foreground">{index + 1}</span>
                                {lesson.kind === 'scenario' ? <FlaskConical className="size-4 text-signal" aria-label="TP animé" /> : <MonitorPlay className="size-4 text-muted-foreground" aria-label="Page" />}
                                <Link href={`/admin/chapitres/${lesson.id}`} className="min-w-0 flex-1 font-medium hover:text-signal">
                                    {lesson.title}
                                </Link>
                                <StatusPill status={lesson.status} />
                                <span className="w-28 text-right text-xs text-muted-foreground">{lesson.kind === 'scenario' ? `${lesson.lab_sessions} séance(s)` : lesson.href}</span>
                                <div className="flex gap-0.5">
                                    <button type="button" onClick={() => reorder(course, index, index - 1)} disabled={index === 0} className="rounded-md p-1.5 text-muted-foreground hover:bg-night-800 disabled:opacity-30" aria-label="Monter">
                                        <ArrowUp className="size-3.5" aria-hidden />
                                    </button>
                                    <button type="button" onClick={() => reorder(course, index, index + 1)} disabled={index === course.lessons.length - 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-night-800 disabled:opacity-30" aria-label="Descendre">
                                        <ArrowDown className="size-3.5" aria-hidden />
                                    </button>
                                </div>
                            </li>
                        ))}
                        <li className="px-5 py-2.5">
                            <Link href={`/admin/chapitres/nouveau?cours=${course.id}`} className="inline-flex items-center gap-1.5 text-sm text-signal hover:underline">
                                <Plus className="size-4" aria-hidden /> Ajouter un chapitre à ce cours
                            </Link>
                        </li>
                    </ol>
                </Panel>
            ))}
            {orphans.length > 0 && (
                <Panel title="Chapitres sans cours" description="Ils restent accessibles par leur adresse mais n’apparaissent dans aucun cours.">
                    <ul className="space-y-1 text-sm">
                        {orphans.map((lesson) => (
                            <li key={lesson.id}>
                                <Link href={`/admin/chapitres/${lesson.id}`} className="hover:text-signal">
                                    {lesson.title}
                                </Link>{' '}
                                <StatusPill status={lesson.status_publication} />
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
            <CourseDialog course={editing} levels={levels} onClose={() => setEditing(null)} />
        </AdminPage>
    );
}

function CourseDialog({ course, levels, onClose }: { course: Course | 'new' | null; levels: Record<string, string>; onClose: () => void }) {
    const existing = course && course !== 'new' ? course : null;
    const form = useForm({
        title: existing?.title ?? '',
        slug: existing?.slug ?? '',
        description: existing?.description ?? '',
        level: existing?.level ?? 'debutant',
        status_publication: existing?.status ?? 'draft',
    });
    return (
        <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent key={existing?.id ?? 'new'} className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{existing ? 'Modifier le cours' : 'Nouveau cours'}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        const options = { preserveScroll: true, onSuccess: onClose };
                        if (existing) form.put(`/admin/cours/${existing.id}`, options);
                        else form.post('/admin/cours', options);
                    }}
                    className="space-y-4"
                >
                    <TextField label="Titre" required value={form.data.title} onChange={(v) => form.setData('title', v)} error={form.errors.title} />
                    <TextField label="Identifiant (URL)" required value={form.data.slug} onChange={(v) => form.setData('slug', v)} error={form.errors.slug} hint="Minuscules et tirets, ex. bases-internet" />
                    <TextArea label="Description" value={form.data.description} onChange={(v) => form.setData('description', v)} error={form.errors.description} rows={3} />
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Niveau" value={form.data.level} onChange={(v) => form.setData('level', v)} options={Object.entries(levels).map(([value, label]) => ({ value, label }))} />
                        <SelectField label="Statut" value={form.data.status_publication} onChange={(v) => form.setData('status_publication', v)} options={[{ value: 'draft', label: 'Brouillon' }, { value: 'published', label: 'Publié' }]} />
                    </div>
                    <SubmitButton processing={form.processing}>Enregistrer</SubmitButton>
                </form>
            </DialogContent>
        </Dialog>
    );
}
