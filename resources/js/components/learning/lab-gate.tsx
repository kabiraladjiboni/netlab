import { Link } from '@inertiajs/react';
import { ArrowRight, Lock, MailCheck, PlayCircle } from 'lucide-react';
import { loginHref } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export type AccessStatus = 'allowed' | 'guest' | 'unverified';

/** Invitation claire à se connecter (ou à vérifier l'e-mail) pour lancer un TP. */
export function LabGate({ access, labHref, className, compact = false, resume }: { access: AccessStatus; labHref: string; className?: string; compact?: boolean; resume?: { progress: number; step: number; total: number } | null }) {
    if (access === 'allowed') {
        return (
            <Link
                href={labHref}
                className={cn('group inline-flex items-center gap-2 rounded-2xl bg-signal px-5 py-3 font-semibold text-on-accent shadow-lg shadow-signal/20 transition hover:brightness-110', className)}
            >
                <PlayCircle className="size-5" aria-hidden />
                {resume && resume.progress > 0 && resume.progress < 100 ? `Reprendre le TP (étape ${resume.step + 1}/${resume.total})` : resume?.progress === 100 ? 'Refaire le TP' : 'Lancer le TP interactif'}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
        );
    }
    if (access === 'unverified') {
        return (
            <div className={cn('rounded-2xl border border-warn/40 bg-warn/10 p-4', className)}>
                <p className="flex items-center gap-2 font-semibold">
                    <MailCheck className="size-5 text-warn" aria-hidden /> Confirme ton adresse e-mail
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Un lien t’a été envoyé. Une fois confirmé, le TP s’ouvrira directement.</p>
                <Link href="/email/verification" className="mt-3 inline-flex text-sm font-semibold text-signal hover:underline">
                    Renvoyer le lien
                </Link>
            </div>
        );
    }
    return (
        <div className={cn('rounded-2xl border border-signal/40 bg-gradient-to-br from-signal/12 to-gold/8 p-5', className)}>
            <p className="flex items-center gap-2 font-display text-lg font-semibold">
                <Lock className="size-5 text-signal" aria-hidden /> Manipule ce TP gratuitement
            </p>
            {!compact && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                    Avance paquet par paquet, examine chaque message, change de variante et retrouve ta progression sur tous tes appareils. Il suffit d’un compte gratuit.
                </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
                <Link href={loginHref(labHref, true)} className="inline-flex items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-accent hover:brightness-110">
                    Commencer gratuitement <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href={loginHref(labHref)} className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-night-800">
                    J’ai déjà un compte
                </Link>
            </div>
        </div>
    );
}
