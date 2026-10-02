import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from 'lucide-react';
import { RowsEditor, SaveBar, StringListEditor } from '@/components/admin/editors';
import { AdminPage, ConfirmButton, Panel } from '@/components/admin/ui';
import { FormErrors, inputClass, SelectField, TextArea, TextField } from '@/components/forms/fields';
import { cn } from '@/lib/utils';

type Question = { type: 'single' | 'multiple' | 'order' | 'match'; prompt: string; context?: string | null; explanation: string; options?: string[]; answer?: number | number[]; items?: string[]; pairs?: { left: string; right: string }[] };
type Quiz = { id: number; slug: string; title: string; description: string | null; module: string | null; status_publication: 'draft' | 'published'; questions: Question[]; attempts: number };

const blank = (type: Question['type']): Question => ({
    type,
    prompt: '',
    context: '',
    explanation: '',
    ...(type === 'single' ? { options: ['', ''], answer: 0 } : type === 'multiple' ? { options: ['', '', ''], answer: [] } : type === 'order' ? { items: ['', '', ''] } : { pairs: [{ left: '', right: '' }, { left: '', right: '' }] }),
});

export default function QuizEdit({ quiz, types }: { quiz: Quiz | null; types: Record<string, string> }) {
    const form = useForm({
        slug: quiz?.slug ?? '',
        title: quiz?.title ?? '',
        description: quiz?.description ?? '',
        module: quiz?.module ?? '',
        status_publication: quiz?.status_publication ?? 'draft',
        questions: quiz?.questions ?? [blank('single')],
    });
    const errors = form.errors as Record<string, string>;
    const setQuestion = (index: number, patch: Partial<Question>) => form.setData('questions', form.data.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
    const moveQuestion = (from: number, to: number) => {
        if (to < 0 || to >= form.data.questions.length) return;
        const copy = [...form.data.questions];
        const [q] = copy.splice(from, 1);
        copy.splice(to, 0, q);
        form.setData('questions', copy);
    };

    return (
        <AdminPage
            title={quiz ? quiz.title : 'Nouveau quiz'}
            back={{ href: '/admin/quiz', label: 'Quiz' }}
            description={quiz && quiz.attempts > 0 ? `${quiz.attempts} tentative(s) déjà enregistrée(s) : modifier les questions ne change pas les anciens scores.` : undefined}
            actions={
                quiz && (
                    <>
                        <a href={`/quiz/${quiz.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-night-800">
                            <Eye className="size-4" aria-hidden /> Tester
                        </a>
                        <ConfirmButton title="Supprimer ce quiz ?" description="Impossible s’il a déjà des résultats ou s’il est rattaché à un chapitre." onConfirm={() => router.delete(`/admin/quiz/${quiz.id}`)} className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-3.5 py-2 text-sm text-danger hover:bg-danger/10">
                            <Trash2 className="size-4" aria-hidden /> Supprimer
                        </ConfirmButton>
                    </>
                )
            }
        >
            <Head title={quiz ? `Quiz — ${quiz.title}` : 'Nouveau quiz'} />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (quiz) form.put(`/admin/quiz/${quiz.id}`, { preserveScroll: true });
                    else form.post('/admin/quiz');
                }}
                className="space-y-5"
                noValidate
            >
                <FormErrors errors={errors} />
                <Panel title="Quiz">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <TextField label="Titre" required value={form.data.title} onChange={(v) => form.setData('title', v)} error={errors.title} />
                        <TextField label="Identifiant" required value={form.data.slug} onChange={(v) => form.setData('slug', v)} error={errors.slug} />
                        <TextField label="Module (facultatif)" value={form.data.module} onChange={(v) => form.setData('module', v)} />
                        <TextArea className="md:col-span-3" label="Description" rows={2} value={form.data.description} onChange={(v) => form.setData('description', v)} />
                    </div>
                </Panel>

                {form.data.questions.map((question, index) => (
                    <Panel
                        key={index}
                        title={`Question ${index + 1} · ${types[question.type]}`}
                        actions={
                            <div className="flex gap-0.5">
                                <button type="button" onClick={() => moveQuestion(index, index - 1)} disabled={index === 0} className="rounded-md p-1.5 text-muted-foreground hover:bg-night-800 disabled:opacity-30" aria-label="Monter la question">
                                    <ArrowUp className="size-4" aria-hidden />
                                </button>
                                <button type="button" onClick={() => moveQuestion(index, index + 1)} disabled={index === form.data.questions.length - 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-night-800 disabled:opacity-30" aria-label="Descendre la question">
                                    <ArrowDown className="size-4" aria-hidden />
                                </button>
                                <button type="button" onClick={() => form.setData('questions', form.data.questions.filter((_, i) => i !== index))} disabled={form.data.questions.length === 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-30" aria-label="Supprimer la question">
                                    <Trash2 className="size-4" aria-hidden />
                                </button>
                            </div>
                        }
                    >
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            <div className="space-y-4">
                                <SelectField label="Type" value={question.type} onChange={(v) => setQuestion(index, { ...blank(v as Question['type']), prompt: question.prompt, explanation: question.explanation, context: question.context })} options={Object.entries(types).map(([value, label]) => ({ value, label }))} />
                                <TextArea label="Énoncé" required rows={2} value={question.prompt} onChange={(v) => setQuestion(index, { prompt: v })} error={errors[`questions.${index}.prompt`]} />
                                <TextArea label="Contexte (facultatif)" rows={2} value={question.context ?? ''} onChange={(v) => setQuestion(index, { context: v })} hint="Extrait de capture, situation…" />
                                <TextArea label="Correction détaillée" required rows={3} value={question.explanation} onChange={(v) => setQuestion(index, { explanation: v })} error={errors[`questions.${index}.explanation`]} hint="Explique pourquoi la bonne réponse est juste et pourquoi les autres sont fausses." />
                            </div>
                            <div>
                                {(question.type === 'single' || question.type === 'multiple') && (
                                    <fieldset className="space-y-2">
                                        <legend className="text-sm font-medium">Choix — coche {question.type === 'single' ? 'la' : 'les'} bonne{question.type === 'single' ? '' : 's'} réponse{question.type === 'single' ? '' : 's'}</legend>
                                        {(question.options ?? []).map((option, optionIndex) => {
                                            const correct = question.type === 'single' ? question.answer === optionIndex : ((question.answer as number[]) ?? []).includes(optionIndex);
                                            return (
                                                <div key={optionIndex} className={cn('flex items-center gap-2 rounded-xl border p-1.5', correct ? 'border-ok/50 bg-ok/8' : 'border-line')}>
                                                    <input
                                                        type={question.type === 'single' ? 'radio' : 'checkbox'}
                                                        name={`q${index}-answer`}
                                                        checked={correct}
                                                        onChange={() => {
                                                            if (question.type === 'single') setQuestion(index, { answer: optionIndex });
                                                            else {
                                                                const current = (question.answer as number[]) ?? [];
                                                                setQuestion(index, { answer: current.includes(optionIndex) ? current.filter((a) => a !== optionIndex) : [...current, optionIndex] });
                                                            }
                                                        }}
                                                        className="ml-1 size-4 accent-[var(--color-ok)]"
                                                        aria-label={`Bonne réponse : choix ${optionIndex + 1}`}
                                                    />
                                                    <input value={option} onChange={(e) => setQuestion(index, { options: (question.options ?? []).map((o, i) => (i === optionIndex ? e.target.value : o)) })} className={cn(inputClass, 'border-0 bg-transparent py-1.5')} placeholder={`Choix ${optionIndex + 1}`} aria-label={`Choix ${optionIndex + 1}`} />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const options = (question.options ?? []).filter((_, i) => i !== optionIndex);
                                                            const answer = question.type === 'single' ? Math.min(Number(question.answer ?? 0), options.length - 1) : ((question.answer as number[]) ?? []).filter((a) => a !== optionIndex).map((a) => (a > optionIndex ? a - 1 : a));
                                                            setQuestion(index, { options, answer });
                                                        }}
                                                        disabled={(question.options ?? []).length <= 2}
                                                        className="rounded-md p-1.5 text-muted-foreground hover:text-danger disabled:opacity-30"
                                                        aria-label={`Supprimer le choix ${optionIndex + 1}`}
                                                    >
                                                        <Trash2 className="size-3.5" aria-hidden />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        <button type="button" onClick={() => setQuestion(index, { options: [...(question.options ?? []), ''] })} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                                            <Plus className="size-4" aria-hidden /> Ajouter un choix
                                        </button>
                                        {(errors[`questions.${index}.answer`] || errors[`questions.${index}.options`]) && <p className="text-xs font-medium text-danger">{errors[`questions.${index}.answer`] ?? errors[`questions.${index}.options`]}</p>}
                                    </fieldset>
                                )}
                                {question.type === 'order' && <StringListEditor label="Éléments, dans le BON ordre (ils seront mélangés pour l’étudiant)" items={question.items ?? []} onChange={(items) => setQuestion(index, { items })} error={errors[`questions.${index}.items`]} />}
                                {question.type === 'match' && (
                                    <RowsEditor<{ left: string; right: string }>
                                        label="Paires à associer"
                                        rows={question.pairs ?? []}
                                        onChange={(pairs) => setQuestion(index, { pairs })}
                                        empty={{ left: '', right: '' }}
                                        columns={[{ key: 'left', label: 'Élément' }, { key: 'right', label: 'Correspondance' }]}
                                        error={errors[`questions.${index}.pairs`]}
                                    />
                                )}
                            </div>
                        </div>
                    </Panel>
                ))}
                <button type="button" onClick={() => form.setData('questions', [...form.data.questions, blank('single')])} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm text-muted-foreground hover:border-signal/50 hover:text-foreground">
                    <Plus className="size-4" aria-hidden /> Ajouter une question
                </button>
                <SaveBar status={form.data.status_publication} onStatus={(s) => form.setData('status_publication', s)} processing={form.processing} dirty={form.isDirty} />
            </form>
        </AdminPage>
    );
}
