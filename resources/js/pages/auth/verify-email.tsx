import { Head, Link, router, useForm } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';
import { SubmitButton } from '@/components/forms/fields';

export default function VerifyEmail({ status, email }: { status: string | null; email: string }) {
    const form = useForm({});
    return (
        <>
            <Head title="Confirme ton adresse" />
            <MailCheck className="size-10 text-signal" aria-hidden />
            <h1 className="mt-4 font-display text-3xl font-semibold">Confirme ton adresse e-mail</h1>
            <p className="mt-3 text-muted-foreground">
                Un lien de confirmation a été envoyé à <strong className="text-foreground">{email}</strong>. Clique dessus pour accéder aux travaux pratiques. Pense à vérifier les courriers indésirables.
            </p>
            {status && <p className="mt-4 rounded-xl border border-ok/40 bg-ok/10 px-3 py-2.5 text-sm">{status}</p>}
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/email/verification/renvoyer');
                }}
                className="mt-6"
            >
                <SubmitButton processing={form.processing} className="w-full">
                    Renvoyer le lien
                </SubmitButton>
            </form>
            <div className="mt-6 flex items-center justify-between text-sm">
                <Link href="/apprendre" className="text-signal hover:underline">
                    Continuer vers les cours
                </Link>
                <button type="button" onClick={() => router.post('/deconnexion')} className="text-muted-foreground hover:text-foreground">
                    Se déconnecter
                </button>
            </div>
        </>
    );
}
