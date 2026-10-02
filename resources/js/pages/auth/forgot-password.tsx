import { Head, Link, useForm } from '@inertiajs/react';
import { SubmitButton, TextField } from '@/components/forms/fields';

export default function ForgotPassword({ status }: { status: string | null }) {
    const form = useForm({ email: '' });
    return (
        <>
            <Head title="Mot de passe oublié" />
            <h1 className="font-display text-3xl font-semibold">Mot de passe oublié</h1>
            <p className="mt-2 mb-6 text-muted-foreground">Indique ton adresse : si un compte existe, tu recevras un lien pour choisir un nouveau mot de passe.</p>
            {status && <p className="mb-4 rounded-xl border border-ok/40 bg-ok/10 px-3 py-2.5 text-sm">{status}</p>}
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/mot-de-passe-oublie');
                }}
                className="space-y-4"
                noValidate
            >
                <TextField label="Adresse e-mail" type="email" autoComplete="email" autoFocus required value={form.data.email} onChange={(v) => form.setData('email', v)} error={form.errors.email} />
                <SubmitButton processing={form.processing} className="w-full">
                    Envoyer le lien
                </SubmitButton>
            </form>
            <p className="mt-6 text-center text-sm">
                <Link href="/connexion" className="text-signal hover:underline">
                    Retour à la connexion
                </Link>
            </p>
        </>
    );
}
