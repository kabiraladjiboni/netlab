import { Head, Link, useForm } from '@inertiajs/react';
import { Checkbox, SubmitButton, TextField } from '@/components/forms/fields';
import { IntendedNotice } from '@/layouts/auth-layout';

export default function Login({ status, intended, canRegister, email }: { status: string | null; intended: string | null; canRegister: boolean; email?: string | null }) {
    const form = useForm({ email: email ?? '', password: '', remember: true });
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post('/connexion', { onFinish: () => form.reset('password') });
    };

    return (
        <>
            <Head title="Connexion" />
            <h1 className="font-display text-3xl font-semibold">Bon retour !</h1>
            <p className="mt-2 mb-6 text-muted-foreground">Connecte-toi pour reprendre tes TP et retrouver ta progression.</p>
            <IntendedNotice intended={intended} />
            {status && <p className="mb-4 rounded-xl border border-ok/40 bg-ok/10 px-3 py-2.5 text-sm">{status}</p>}
            <form onSubmit={submit} className="space-y-4" noValidate>
                <TextField label="Adresse e-mail" type="email" autoComplete="username" autoFocus={!email} required value={form.data.email} onChange={(v) => form.setData('email', v)} error={form.errors.email} />
                <div>
                    <TextField label="Mot de passe" type="password" autoComplete="current-password" autoFocus={Boolean(email)} required value={form.data.password} onChange={(v) => form.setData('password', v)} error={form.errors.password} />
                    <Link href="/mot-de-passe-oublie" className="mt-1.5 inline-block text-xs text-signal hover:underline">
                        Mot de passe oublié ?
                    </Link>
                </div>
                <Checkbox label="Rester connecté sur cet appareil" checked={form.data.remember} onChange={(v) => form.setData('remember', v)} />
                <SubmitButton processing={form.processing} className="w-full">
                    Se connecter
                </SubmitButton>
            </form>
            {canRegister && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                    Pas encore de compte ?{' '}
                    <Link href="/inscription" className="font-semibold text-signal hover:underline">
                        Créer un compte gratuit
                    </Link>
                </p>
            )}
        </>
    );
}
