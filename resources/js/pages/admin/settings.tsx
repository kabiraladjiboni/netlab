import { Head, router, useForm } from '@inertiajs/react';
import { KeyRound, Upload } from 'lucide-react';
import { useRef } from 'react';
import { AdminPage, Definition, Panel } from '@/components/admin/ui';
import { Checkbox, FormErrors, SubmitButton, TextArea, TextField } from '@/components/forms/fields';

type Setting = { key: string; input: string | null; label: string; group: string; help: string | null; type: 'boolean' | 'integer' | 'string'; value: string | number | boolean | null };
type Env = { app_env: string; mail: string; ai_provider: string; ai_configured: boolean; geo_header: string | null; geo_ranges: number };

export default function SettingsPage({ settings, groups, environment }: { settings: Setting[]; groups: Record<string, string>; environment: Env }) {
    const form = useForm({ values: Object.fromEntries(settings.map((s) => [s.key, s.value ?? (s.type === 'boolean' ? false : '')])) as Record<string, string | number | boolean> });
    const fileRef = useRef<HTMLInputElement>(null);
    const errors = form.errors as Record<string, string>;
    const errorFor = (key: string) => errors[`values.${key}`];

    return (
        <AdminPage title="Paramètres" description="Réglages de la plateforme. Les secrets (clés d’API, SMTP) et les protections de sécurité ne sont pas modifiables ici : ils restent dans le fichier .env.">
            <Head title="Paramètres" />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.put('/admin/parametres', { preserveScroll: true });
                }}
                className="space-y-5"
                noValidate
            >
                <FormErrors errors={errors} />
                {Object.entries(groups).map(([group, title]) => (
                    <Panel key={group} title={title}>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {settings
                                .filter((s) => s.group === group)
                                .map((s) =>
                                    s.type === 'boolean' ? (
                                        <Checkbox key={s.key} label={s.label} hint={s.help} checked={Boolean(form.data.values[s.key])} onChange={(v) => form.setData('values', { ...form.data.values, [s.key]: v })} error={errorFor(s.key)} className="md:col-span-2" />
                                    ) : s.input === 'textarea' ? (
                                        <TextArea key={s.key} className="md:col-span-2" rows={4} label={s.label} hint={s.help} value={String(form.data.values[s.key] ?? '')} onChange={(v) => form.setData('values', { ...form.data.values, [s.key]: v })} error={errorFor(s.key)} />
                                    ) : s.key === 'platform.logo_url' ? (
                                        <div key={s.key} className="space-y-1.5">
                                            <p className="text-sm font-medium">Logo</p>
                                            <div className="flex items-center gap-3">
                                                {form.data.values[s.key] ? <img src={String(form.data.values[s.key])} alt="Logo actuel" className="size-10 rounded-lg border border-line object-contain" /> : <span className="text-sm text-muted-foreground">Logo par défaut</span>}
                                                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && router.post('/admin/parametres/logo', { logo: e.target.files[0] }, { forceFormData: true, preserveScroll: true })} />
                                                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm">
                                                    <Upload className="size-4" aria-hidden /> Téléverser (PNG, JPG, WebP, 512 Ko)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <TextField
                                            key={s.key}
                                            label={s.label}
                                            hint={s.help}
                                            type={s.type === 'integer' ? 'number' : 'text'}
                                            value={form.data.values[s.key] as string | number}
                                            onChange={(v) => form.setData('values', { ...form.data.values, [s.key]: s.type === 'integer' ? Number(v) : v })}
                                            error={errorFor(s.key)}
                                        />
                                    ),
                                )}
                        </div>
                    </Panel>
                ))}
                <div className="flex justify-end">
                    <SubmitButton processing={form.processing}>Enregistrer les paramètres</SubmitButton>
                </div>
            </form>

            <Panel title={<span className="flex items-center gap-2"><KeyRound className="size-4" aria-hidden /> Configuration du serveur (lecture seule)</span>}>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    {[
                        ['Environnement', environment.app_env],
                        ['Envoi des e-mails (MAIL_MAILER)', environment.mail === 'log' ? 'log — les e-mails sont écrits dans storage/logs, pas envoyés' : environment.mail],
                        ['Assistant IA', environment.ai_configured ? `Fournisseur : ${environment.ai_provider}` : 'Non configuré (réponses issues du contenu de la plateforme)'],
                        ['Pays estimé', environment.geo_header ? `En-tête ${environment.geo_header}` : environment.geo_ranges > 0 ? `${environment.geo_ranges.toLocaleString('fr-FR')} plages IP importées` : 'Non configuré'],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-line p-3">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="mt-1 font-medium">{value}</dd>
                        </div>
                    ))}
                </dl>
                <div className="mt-4">
                    <Definition>Clés d’API, mot de passe SMTP, en-tête de géolocalisation : à définir dans .env puis « php artisan config:clear ». Elles ne sont jamais envoyées au navigateur.</Definition>
                </div>
            </Panel>
        </AdminPage>
    );
}
