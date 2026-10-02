import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import { Checkbox, FormErrors, SubmitButton, TextField } from '@/components/forms/fields';
import { PasswordStrength } from '@/components/forms/password-strength';
import { IntendedNotice } from '@/layouts/auth-layout';
import type { SharedProps } from '@/types/shared';

export default function Register({ open, intended }: { open: boolean; intended: string | null }) {
    const { app } = usePage<SharedProps>().props;
    const form = useForm({ name: '', email: '', password: '', password_confirmation: '', terms: false });
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post('/inscription', { onFinish: () => form.reset('password', 'password_confirmation') });
    };

    if (!open) {
        return (
            <>
                <Head title="Inscription" />
                <h1 className="font-display text-3xl font-semibold">Inscriptions fermées</h1>
                <p className="mt-3 text-muted-foreground">Les inscriptions sont momentanément suspendues. Les cours restent accessibles sans compte.</p>
                <Link href="/apprendre" className="mt-6 inline-flex rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent">
                    Voir les cours
                </Link>
            </>
        );
    }

    return (
        <>
            <Head title="Créer un compte" />
            <h1 className="font-display text-3xl font-semibold">Crée ton compte gratuit</h1>
            <p className="mt-2 mb-6 text-muted-foreground">Trois informations suffisent. Aucun paiement, aucune carte bancaire.</p>
            <IntendedNotice intended={intended} />
            <form onSubmit={submit} className="space-y-4" noValidate>
                <FormErrors errors={form.hasErrors && Object.keys(form.errors).length > 2 ? form.errors : {}} />
                <TextField label="Nom affiché" autoComplete="nickname" autoFocus required maxLength={60} value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} hint="Visible seulement par toi et l’équipe." />
                <TextField label="Adresse e-mail" type="email" autoComplete="email" required value={form.data.email} onChange={(v) => form.setData('email', v)} error={form.errors.email} hint="Tu recevras un lien pour la confirmer." />
                <TextField label="Mot de passe" type="password" autoComplete="new-password" required value={form.data.password} onChange={(v) => form.setData('password', v)} maxLength={128} error={form.errors.password} />
                <PasswordStrength value={form.data.password} />
                <TextField label="Confirme le mot de passe" type="password" autoComplete="new-password" required value={form.data.password_confirmation} onChange={(v) => form.setData('password_confirmation', v)} error={form.errors.password_confirmation} />
                <Checkbox
                    checked={form.data.terms}
                    onChange={(v) => form.setData('terms', v)}
                    error={form.errors.terms}
                    label={
                        <>
                            J’accepte les{' '}
                            <a href={app.terms_url} target="_blank" rel="noreferrer" className="text-signal underline-offset-2 hover:underline">
                                conditions d’utilisation
                            </a>{' '}
                            et la{' '}
                            <a href={app.privacy_url} target="_blank" rel="noreferrer" className="text-signal underline-offset-2 hover:underline">
                                politique de confidentialité
                            </a>
                            .
                        </>
                    }
                />
                <SubmitButton processing={form.processing} className="w-full">
                    Créer mon compte
                </SubmitButton>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5" aria-hidden /> Mot de passe chiffré, jamais visible par l’équipe.
                </p>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
                Déjà inscrit ?{' '}
                <Link href="/connexion" className="font-semibold text-signal hover:underline">
                    Se connecter
                </Link>
            </p>
        </>
    );
}
