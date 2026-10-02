import { Head, router, useForm } from '@inertiajs/react';
import { Ban, MailCheck, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Kpi } from '@/components/admin/charts';
import { AdminPage, ConfirmButton, Panel, StatusPill } from '@/components/admin/ui';
import { SubmitButton, TextArea, TextField } from '@/components/forms/fields';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { countryFlag, formatDate, formatDateTime, timeAgo } from '@/lib/format';
import type { UserRow } from './index';

type Props = {
    account: UserRow & { terms_accepted_at: string | null; suspension_reason: string | null };
    learning: { labs_started: number; labs_completed: number; diagnostics_solved: number; quiz_attempts: number; quiz_average: number | null; lessons_visited: number; favorites: number; feedback: number; sessions: { id: number; type: string; slug: string; status: string; progress: number; date: string }[] };
    isSelf: boolean;
};

export default function UserShow({ account, learning, isSelf }: Props) {
    const [suspendOpen, setSuspendOpen] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);
    const suspend = useForm({ reason: '' });
    const role = useForm({ role: account.role === 'admin' ? 'student' : 'admin', password: '' });

    return (
        <AdminPage title={account.name} description={account.email} back={{ href: '/admin/utilisateurs', label: 'Utilisateurs' }}>
            <Head title={account.name} />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-5">
                    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Kpi label="TP terminés" value={`${learning.labs_completed} / ${learning.labs_started}`} hint="terminés / commencés" />
                        <Kpi label="Diagnostics résolus" value={learning.diagnostics_solved} />
                        <Kpi label="Quiz" value={learning.quiz_attempts} hint={learning.quiz_average === null ? 'Moyenne : —' : `Moyenne : ${learning.quiz_average} %`} />
                        <Kpi label="Leçons consultées" value={learning.lessons_visited} hint={`${learning.favorites} favori(s) · ${learning.feedback} retour(s)`} />
                    </section>
                    <Panel title="Dernières séances" padded={false}>
                        {learning.sessions.length === 0 ? (
                            <p className="p-5 text-sm text-muted-foreground">Aucune séance de TP.</p>
                        ) : (
                            <ul className="divide-y divide-line/60">
                                {learning.sessions.map((session) => (
                                    <li key={session.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                                        <StatusPill status={session.status === 'completed' ? 'completed' : 'in_progress'} />
                                        <span className="text-xs text-muted-foreground">{session.type === 'scenario' ? 'TP' : 'Diagnostic'}</span>
                                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{session.slug}</span>
                                        <span className="tabular-nums">{session.progress} %</span>
                                        <span className="w-32 text-right text-xs text-muted-foreground">{formatDateTime(session.date)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
                <aside className="space-y-5">
                    <Panel title="Compte">
                        <dl className="space-y-2 text-sm">
                            {[
                                ['Rôle', account.role === 'admin' ? 'Administrateur' : 'Étudiant'],
                                ['E-mail', account.verified ? 'Vérifié' : 'Non vérifié'],
                                ['Pays déclaré', account.country ? `${countryFlag(account.country)} ${account.country_name}` : '—'],
                                ['Inscription', formatDate(account.created_at)],
                                ['Conditions acceptées', formatDate(account.terms_accepted_at)],
                                ['Dernière activité', timeAgo(account.last_active_at)],
                            ].map(([label, value]) => (
                                <div key={label} className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="text-right font-medium">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        {account.suspended && (
                            <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
                                <strong className="text-danger">Compte suspendu.</strong> {account.suspension_reason}
                            </p>
                        )}
                    </Panel>
                    {!isSelf && (
                        <Panel title="Actions">
                            <div className="flex flex-col gap-2">
                                {!account.verified && (
                                    <button type="button" onClick={() => router.post(`/admin/utilisateurs/${account.id}/verification`, {}, { preserveScroll: true })} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-night-800">
                                        <MailCheck className="size-4" aria-hidden /> Renvoyer l’e-mail de vérification
                                    </button>
                                )}
                                {account.suspended ? (
                                    <button type="button" onClick={() => router.post(`/admin/utilisateurs/${account.id}/reactiver`, {}, { preserveScroll: true })} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-night-800">
                                        <RotateCcw className="size-4" aria-hidden /> Réactiver le compte
                                    </button>
                                ) : (
                                    account.role !== 'admin' && (
                                        <button type="button" onClick={() => setSuspendOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-warn/40 px-3 py-2 text-sm text-warn hover:bg-warn/10">
                                            <Ban className="size-4" aria-hidden /> Suspendre (abus)
                                        </button>
                                    )
                                )}
                                <button type="button" onClick={() => setRoleOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-night-800">
                                    <ShieldCheck className="size-4" aria-hidden /> {account.role === 'admin' ? 'Retirer le rôle administrateur' : 'Donner le rôle administrateur'}
                                </button>
                                {account.role !== 'admin' && (
                                    <ConfirmButton
                                        title="Supprimer ce compte ?"
                                        description="Le compte et toutes ses données pédagogiques seront supprimés définitivement. À utiliser pour traiter une demande de suppression."
                                        confirmLabel="Supprimer définitivement"
                                        requireText={account.email}
                                        onConfirm={(typed) => router.delete(`/admin/utilisateurs/${account.id}`, { data: { confirmation: typed } })}
                                        className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
                                    >
                                        <Trash2 className="size-4" aria-hidden /> Supprimer le compte
                                    </ConfirmButton>
                                )}
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">Chaque action est enregistrée dans le journal d’administration.</p>
                        </Panel>
                    )}
                </aside>
            </div>

            <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Suspendre {account.name}</DialogTitle>
                        <DialogDescription>L’étudiant sera déconnecté et ne pourra plus se connecter tant que le compte n’est pas réactivé.</DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            suspend.post(`/admin/utilisateurs/${account.id}/suspendre`, { preserveScroll: true, onSuccess: () => setSuspendOpen(false) });
                        }}
                        className="space-y-4"
                    >
                        <TextArea label="Motif (consigné dans le journal)" required value={suspend.data.reason} onChange={(v) => suspend.setData('reason', v)} error={suspend.errors.reason} rows={3} />
                        <SubmitButton variant="danger" processing={suspend.processing}>
                            Suspendre
                        </SubmitButton>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{account.role === 'admin' ? 'Retirer le rôle administrateur' : 'Donner le rôle administrateur'}</DialogTitle>
                        <DialogDescription>Action sensible : confirme avec ton propre mot de passe. Un administrateur a accès à toutes les données de la plateforme.</DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            role.post(`/admin/utilisateurs/${account.id}/role`, { preserveScroll: true, onSuccess: () => setRoleOpen(false), onFinish: () => role.reset('password') });
                        }}
                        className="space-y-4"
                    >
                        <TextField label="Ton mot de passe" type="password" autoComplete="current-password" required value={role.data.password} onChange={(v) => role.setData('password', v)} error={role.errors.password ?? role.errors.role} />
                        <SubmitButton processing={role.processing}>Confirmer</SubmitButton>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminPage>
    );
}
