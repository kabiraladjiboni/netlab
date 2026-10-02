import { Head, Link, useForm } from '@inertiajs/react';
import { Check, Copy, KeyRound, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { SubmitButton, TextField } from '@/components/forms/fields';
import { QrCode } from '@/components/forms/qr-code';
import { StudentShell } from '@/components/learning/student-shell';
import { formatDate } from '@/lib/format';

type Props = {
    enabled: boolean;
    confirmedAt: string | null;
    recoveryRemaining: number;
    pending: { secret: string; uri: string } | null;
    recoveryCodes: string[] | null;
    required: boolean;
    continueTo: string | null;
};

export default function SecurityPage({ enabled, confirmedAt, recoveryRemaining, pending, recoveryCodes, required, continueTo }: Props) {
    return (
        <StudentShell title="Sécurité du compte" description="La double authentification protège ton compte même si ton mot de passe est découvert.">
            <Head title="Sécurité" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <section className="space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="titre-2fa">
                    <div className="flex items-start gap-3">
                        <span className={enabled ? 'rounded-xl bg-ok/15 p-2 text-ok' : 'rounded-xl bg-warn/15 p-2 text-warn'}>{enabled ? <ShieldCheck className="size-5" aria-hidden /> : <ShieldAlert className="size-5" aria-hidden />}</span>
                        <div>
                            <h2 id="titre-2fa" className="font-display text-lg font-semibold">
                                Double authentification {enabled ? 'activée' : 'désactivée'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {enabled
                                    ? `Active depuis le ${formatDate(confirmedAt)}. À chaque connexion, un code de ton application t’est demandé.`
                                    : 'Après ton mot de passe, un code à 6 chiffres affiché par une application (Google Authenticator, Microsoft Authenticator, Aegis, 2FAS…) te sera demandé.'}
                            </p>
                            {required && !enabled && <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm">Obligatoire pour les administrateurs : l’administration reste inaccessible tant qu’elle n’est pas activée.</p>}
                        </div>
                    </div>

                    {recoveryCodes && <RecoveryCodes codes={recoveryCodes} continueTo={continueTo} />}

                    {!enabled && !pending && <StartForm />}
                    {!enabled && pending && <ConfirmForm pending={pending} />}
                    {enabled && !recoveryCodes && <DisableForm />}
                </section>

                <aside className="space-y-5">
                    {enabled && (
                        <section className="space-y-3 rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="titre-codes">
                            <h2 id="titre-codes" className="flex items-center gap-2 font-display text-lg font-semibold">
                                <KeyRound className="size-5 text-signal" aria-hidden /> Codes de secours
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Il te reste <strong className="text-foreground">{recoveryRemaining}</strong> code{recoveryRemaining > 1 ? 's' : ''} sur 8. Chacun permet de te connecter une fois si tu n’as plus ton téléphone.
                            </p>
                            <RegenerateForm />
                        </section>
                    )}
                    <section className="space-y-2 rounded-3xl border border-line bg-surface p-5 text-sm text-muted-foreground sm:p-6">
                        <h2 className="font-display text-base font-semibold text-foreground">Bonnes pratiques</h2>
                        <ul className="list-disc space-y-1.5 pl-5">
                            <li>Un mot de passe long et unique (une phrase de plusieurs mots), jamais réutilisé ailleurs.</li>
                            <li>Range tes codes de secours hors de ton téléphone (papier, gestionnaire de mots de passe).</li>
                            <li>L’équipe ne te demandera jamais ton mot de passe ni un code par e-mail ou message.</li>
                        </ul>
                    </section>
                </aside>
            </div>
        </StudentShell>
    );
}

function StartForm() {
    const form = useForm({ password: '' });
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post('/app/securite/2fa', { preserveScroll: true, onFinish: () => form.reset('password') });
            }}
            className="space-y-3"
            noValidate
        >
            <TextField label="Confirme ton mot de passe pour commencer" type="password" autoComplete="current-password" required value={form.data.password} onChange={(v) => form.setData('password', v)} error={form.errors.password} />
            <SubmitButton processing={form.processing}>
                <Smartphone className="size-4" aria-hidden /> Activer la double authentification
            </SubmitButton>
        </form>
    );
}

function ConfirmForm({ pending }: { pending: { secret: string; uri: string } }) {
    const form = useForm({ code: '' });
    const cancel = useForm({});
    return (
        <div className="space-y-4">
            <ol className="space-y-4">
                <li className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <QrCode value={pending.uri} label="QR code à scanner avec ton application d’authentification" />
                    <div className="space-y-2 text-sm">
                        <p>
                            <strong>1.</strong> Dans ton application d’authentification, ajoute un compte en scannant ce QR code.
                        </p>
                        <p className="text-muted-foreground">Impossible de scanner ? Saisis cette clé à la main :</p>
                        <code className="block rounded-lg bg-night-800 px-3 py-2 font-mono text-sm tracking-wider break-all select-all">{pending.secret}</code>
                    </div>
                </li>
            </ol>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/app/securite/2fa/confirmer', { preserveScroll: true });
                }}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                noValidate
            >
                <TextField
                    className="sm:w-56"
                    label="2. Code à 6 chiffres affiché"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                    value={form.data.code}
                    onChange={(v) => form.setData('code', v.replace(/\D/g, ''))}
                    error={form.errors.code}
                />
                <div className="flex gap-2">
                    <SubmitButton processing={form.processing}>Confirmer</SubmitButton>
                    <button type="button" onClick={() => cancel.post('/app/securite/2fa/annuler', { preserveScroll: true })} className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-night-800">
                        Annuler
                    </button>
                </div>
            </form>
        </div>
    );
}

function RecoveryCodes({ codes, continueTo }: { codes: string[]; continueTo: string | null }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(codes.join('\n'));
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };
    return (
        <div className="space-y-3 rounded-2xl border border-gold/40 bg-gold/10 p-4">
            <p className="text-sm font-semibold">Tes codes de secours (affichés une seule fois)</p>
            <p className="text-sm text-muted-foreground">Note-les maintenant : chacun te permet de te connecter une fois si tu perds ton téléphone.</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                {codes.map((code) => (
                    <li key={code} className="rounded-lg bg-night-850 px-3 py-1.5 text-center tracking-wider">
                        {code}
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-night-800">
                    {copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? 'Copiés' : 'Copier les codes'}
                </button>
                {continueTo && (
                    <Link href={continueTo} className="inline-flex items-center rounded-xl bg-signal px-3 py-2 text-sm font-semibold text-on-accent">
                        Continuer vers l’administration
                    </Link>
                )}
            </div>
        </div>
    );
}

function RegenerateForm() {
    const form = useForm({ password: '' });
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post('/app/securite/2fa/codes', { preserveScroll: true, onFinish: () => form.reset('password') });
            }}
            className="space-y-3"
            noValidate
        >
            <TextField label="Mot de passe" type="password" autoComplete="current-password" required value={form.data.password} onChange={(v) => form.setData('password', v)} error={form.errors.password} />
            <SubmitButton processing={form.processing} variant="outline">
                Générer de nouveaux codes
            </SubmitButton>
        </form>
    );
}

function DisableForm() {
    const form = useForm({ password: '', code: '' });
    return (
        <details className="rounded-2xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-medium">Désactiver la double authentification</summary>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.delete('/app/securite/2fa', { preserveScroll: true, onFinish: () => form.reset() });
                }}
                className="mt-3 space-y-3"
                noValidate
            >
                <TextField label="Mot de passe" type="password" autoComplete="current-password" required value={form.data.password} onChange={(v) => form.setData('password', v)} error={form.errors.password} />
                <TextField label="Code de l’application ou code de secours" autoComplete="one-time-code" required value={form.data.code} onChange={(v) => form.setData('code', v)} error={form.errors.code} />
                <SubmitButton processing={form.processing} variant="danger">
                    Désactiver
                </SubmitButton>
            </form>
        </details>
    );
}
