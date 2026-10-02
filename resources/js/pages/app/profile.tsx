import { Head, useForm } from '@inertiajs/react';
import { BadgeCheck, MailWarning } from 'lucide-react';
import { SelectField, SubmitButton, TextField } from '@/components/forms/fields';
import { PasswordStrength } from '@/components/forms/password-strength';
import { StudentShell } from '@/components/learning/student-shell';
import { formatDate } from '@/lib/format';

type Profile = { name: string; email: string; country: string | null; verified: boolean; created_at: string | null };

export default function ProfilePage({ profile, countries }: { profile: Profile; countries: Record<string, string> }) {
    const form = useForm({ name: profile.name, email: profile.email, country: profile.country ?? '' });
    const password = useForm({ current_password: '', password: '', password_confirmation: '' });

    return (
        <StudentShell title="Mon profil" description={`Membre depuis le ${formatDate(profile.created_at)}`}>
            <Head title="Mon profil" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.patch('/app/mon-profil', { preserveScroll: true });
                    }}
                    className="space-y-4 rounded-3xl border border-line bg-surface p-5 sm:p-6"
                    noValidate
                >
                    <h2 className="font-display text-lg font-semibold">Informations</h2>
                    <TextField label="Nom affiché" required value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} maxLength={60} />
                    <TextField
                        label="Adresse e-mail"
                        type="email"
                        required
                        value={form.data.email}
                        onChange={(v) => form.setData('email', v)}
                        error={form.errors.email}
                        hint={profile.verified ? <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" aria-hidden /> Adresse vérifiée</span> : <span className="inline-flex items-center gap-1 text-warn"><MailWarning className="size-3.5" aria-hidden /> Adresse non vérifiée</span>}
                    />
                    <SelectField
                        label="Pays (facultatif)"
                        value={form.data.country}
                        onChange={(v) => form.setData('country', v)}
                        error={form.errors.country}
                        placeholder="Ne pas préciser"
                        options={Object.entries(countries).map(([value, label]) => ({ value, label }))}
                        hint="Aide l’équipe à comprendre où la plateforme est utilisée. Jamais affiché publiquement."
                    />
                    <SubmitButton processing={form.processing}>Enregistrer</SubmitButton>
                </form>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        password.put('/app/mon-profil/mot-de-passe', { preserveScroll: true, onSuccess: () => password.reset() });
                    }}
                    className="space-y-4 rounded-3xl border border-line bg-surface p-5 sm:p-6"
                    noValidate
                >
                    <h2 className="font-display text-lg font-semibold">Mot de passe</h2>
                    <TextField label="Mot de passe actuel" type="password" autoComplete="current-password" required value={password.data.current_password} onChange={(v) => password.setData('current_password', v)} error={password.errors.current_password} />
                    <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" required value={password.data.password} onChange={(v) => password.setData('password', v)} maxLength={128} error={password.errors.password} />
                    <PasswordStrength value={password.data.password} />
                    <TextField label="Confirmation" type="password" autoComplete="new-password" required value={password.data.password_confirmation} onChange={(v) => password.setData('password_confirmation', v)} />
                    <SubmitButton processing={password.processing}>Changer le mot de passe</SubmitButton>
                    <p className="text-xs text-muted-foreground">Tes autres appareils seront déconnectés par sécurité.</p>
                </form>
            </div>
        </StudentShell>
    );
}
