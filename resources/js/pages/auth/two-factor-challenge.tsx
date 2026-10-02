import { Head, Link, useForm } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { SubmitButton, TextField } from '@/components/forms/fields';

export default function TwoFactorChallenge() {
    const [recovery, setRecovery] = useState(false);
    const form = useForm({ code: '', recovery_code: '' });
    return (
        <>
            <Head title="Vérification en deux étapes" />
            <span className="mb-4 inline-flex w-fit self-start rounded-xl bg-signal/15 p-2.5 text-signal">
                <ShieldCheck className="size-6" aria-hidden />
            </span>
            <h1 className="font-display text-3xl font-semibold">Vérification en deux étapes</h1>
            <p className="mt-2 mb-6 text-muted-foreground">
                {recovery ? 'Saisis l’un de tes codes de secours. Il ne pourra plus servir ensuite.' : 'Ouvre ton application d’authentification et saisis le code à 6 chiffres affiché pour ton compte.'}
            </p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.transform((data) => (recovery ? { recovery_code: data.recovery_code } : { code: data.code }));
                    form.post('/connexion/verification', { onError: () => form.reset() });
                }}
                className="space-y-4"
                noValidate
            >
                {recovery ? (
                    <TextField key="recovery" label="Code de secours" autoComplete="one-time-code" autoFocus required value={form.data.recovery_code} onChange={(v) => form.setData('recovery_code', v)} error={form.errors.recovery_code} placeholder="XXXXXX-XXXXXX" />
                ) : (
                    <TextField
                        key="code"
                        label="Code de vérification"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                        required
                        value={form.data.code}
                        onChange={(v) => form.setData('code', v.replace(/\D/g, ''))}
                        error={form.errors.code}
                    />
                )}
                <SubmitButton processing={form.processing} className="w-full">
                    Vérifier
                </SubmitButton>
            </form>
            <div className="mt-6 flex flex-col items-center gap-2 text-sm">
                <button type="button" onClick={() => setRecovery((v) => !v)} className="text-signal hover:underline">
                    {recovery ? 'Utiliser le code de l’application' : 'Je n’ai pas mon téléphone : utiliser un code de secours'}
                </button>
                <Link href="/connexion" className="text-muted-foreground hover:text-foreground">
                    Retour à la connexion
                </Link>
            </div>
        </>
    );
}
