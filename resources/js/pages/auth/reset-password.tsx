import { Head, useForm } from '@inertiajs/react';
import { SubmitButton, TextField } from '@/components/forms/fields';
import { PasswordStrength } from '@/components/forms/password-strength';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
    const form = useForm({ token, email, password: '', password_confirmation: '' });
    return (
        <>
            <Head title="Nouveau mot de passe" />
            <h1 className="font-display text-3xl font-semibold">Nouveau mot de passe</h1>
            <p className="mt-2 mb-6 text-muted-foreground">Choisis un mot de passe d’au moins 12 caractères. Une phrase de passe de plusieurs mots est idéale.</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/reinitialiser-mot-de-passe', { onFinish: () => form.reset('password', 'password_confirmation') });
                }}
                className="space-y-4"
                noValidate
            >
                <TextField label="Adresse e-mail" type="email" autoComplete="email" required value={form.data.email} onChange={(v) => form.setData('email', v)} error={form.errors.email} />
                <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" autoFocus required value={form.data.password} onChange={(v) => form.setData('password', v)} maxLength={128} error={form.errors.password} />
                <PasswordStrength value={form.data.password} />
                <TextField label="Confirmation" type="password" autoComplete="new-password" required value={form.data.password_confirmation} onChange={(v) => form.setData('password_confirmation', v)} />
                <SubmitButton processing={form.processing} className="w-full">
                    Enregistrer le mot de passe
                </SubmitButton>
            </form>
        </>
    );
}
