import { Head, useForm } from '@inertiajs/react';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SubmitButton, TextField } from '@/components/forms/fields';
import { PreferencesFields } from '@/components/layout/display-preferences';
import { useToast } from '@/components/layout/flash-toaster';
import { StudentShell } from '@/components/learning/student-shell';
import { usePreferences } from '@/hooks/use-preferences';
import { sendJson } from '@/lib/api';

export default function SettingsPage() {
    const { level, theme, reduceMotionSetting } = usePreferences();
    const { notify } = useToast();
    const [saving, setSaving] = useState(false);
    const destroy = useForm({ password: '', confirmation: '' });

    const savePreferences = async () => {
        setSaving(true);
        try {
            await sendJson('PATCH', '/app/parametres', { level, theme, reduce_motion: reduceMotionSetting });
            notify('Préférences enregistrées sur ton compte : elles te suivront sur tes autres appareils.');
        } catch (error) {
            notify((error as Error).message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <StudentShell title="Paramètres" description="Affichage, données personnelles et compte.">
            <Head title="Paramètres" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section className="space-y-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                    <h2 className="font-display text-lg font-semibold">Affichage</h2>
                    <PreferencesFields />
                    <button type="button" onClick={savePreferences} disabled={saving} className="rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent disabled:opacity-60">
                        {saving ? 'Enregistrement…' : 'Enregistrer sur mon compte'}
                    </button>
                </section>

                <div className="space-y-5">
                    <section className="space-y-3 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                        <h2 className="font-display text-lg font-semibold">Mes données</h2>
                        <p className="text-sm text-muted-foreground">Télécharge un fichier contenant toutes les données liées à ton compte : profil, progression, résultats, favoris, évaluations et signalements.</p>
                        <a href="/app/parametres/export" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-night-800">
                            <Download className="size-4" aria-hidden /> Télécharger mes données (JSON)
                        </a>
                    </section>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            destroy.delete('/app/parametres/compte', { preserveScroll: true });
                        }}
                        className="space-y-3 rounded-3xl border border-danger/40 bg-danger/5 p-5 sm:p-6"
                        noValidate
                    >
                        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-danger">
                            <Trash2 className="size-5" aria-hidden /> Supprimer mon compte
                        </h2>
                        <p className="text-sm text-muted-foreground">Suppression définitive et immédiate de ton compte, de ta progression, de tes résultats et de tes favoris. Cette action est irréversible.</p>
                        <TextField label="Mot de passe" type="password" autoComplete="current-password" value={destroy.data.password} onChange={(v) => destroy.setData('password', v)} error={destroy.errors.password} />
                        <TextField label={<>Écris <strong className="font-mono">SUPPRIMER</strong> pour confirmer</>} value={destroy.data.confirmation} onChange={(v) => destroy.setData('confirmation', v)} error={destroy.errors.confirmation} />
                        <SubmitButton variant="danger" processing={destroy.processing} disabled={destroy.data.confirmation !== 'SUPPRIMER' || !destroy.data.password}>
                            Supprimer définitivement
                        </SubmitButton>
                    </form>
                </div>
            </div>
        </StudentShell>
    );
}
