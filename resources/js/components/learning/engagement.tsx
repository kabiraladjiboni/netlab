import { Flag, Heart, MessageSquareText, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/layout/flash-toaster';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { inputClass } from '@/components/forms/fields';
import { useAuth, loginHref } from '@/hooks/use-auth';
import { sendJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';

export type Engagement = { type: 'lesson' | 'protocol' | 'lab'; slug: string; favorite: boolean; rating: { value: 'useful' | 'unclear'; comment: string | null } | null } | null;

const CATEGORIES: Record<string, string> = {
    explication: 'Une explication est difficile à comprendre',
    erreur: 'Erreur technique dans le contenu',
    animation: 'L’animation ne fonctionne pas bien',
    quiz: 'Une question de quiz est ambiguë',
    accessibilite: 'Problème d’accessibilité',
    technique: 'Bug ou page qui ne marche pas',
    autre: 'Autre chose',
};

/** Favori, avis « utile / pas encore clair » et signalement, regroupés et discrets. */
export function EngagementBar({ engagement, type, slug, subjectType, className }: { engagement: Engagement; type: 'lesson' | 'protocol' | 'lab'; slug: string; subjectType?: string; className?: string }) {
    const user = useAuth();
    const { notify } = useToast();
    const [favorite, setFavorite] = useState(engagement?.favorite ?? false);
    const [rating, setRating] = useState(engagement?.rating ?? null);
    const [commentOpen, setCommentOpen] = useState(false);
    const [comment, setComment] = useState(engagement?.rating?.comment ?? '');
    const [reportOpen, setReportOpen] = useState(false);

    if (!user) {
        return (
            <div className={cn('flex flex-wrap items-center gap-2 text-sm text-muted-foreground', className)}>
                <Heart className="size-4" aria-hidden />
                <span>
                    <Link href={loginHref()} className="text-signal hover:underline">
                        Connecte-toi
                    </Link>{' '}
                    pour ajouter aux favoris et donner ton avis.
                </span>
            </div>
        );
    }

    const toggleFavorite = async () => {
        const previous = favorite;
        setFavorite(!previous);
        try {
            const response = await sendJson<{ favorite: boolean }>('POST', '/api/favoris', { type, slug });
            setFavorite(response.favorite);
            notify(response.favorite ? 'Ajouté à tes favoris.' : 'Retiré de tes favoris.');
        } catch (error) {
            setFavorite(previous);
            notify((error as Error).message, 'error');
        }
    };

    const rate = async (value: 'useful' | 'unclear', withComment?: string) => {
        try {
            const response = await sendJson<{ rating: { value: 'useful' | 'unclear'; comment: string | null } }>('PUT', '/api/evaluations', { type, slug, value, comment: withComment ?? rating?.comment ?? null });
            setRating(response.rating);
            notify(withComment !== undefined ? 'Merci, ton commentaire a été transmis à l’équipe.' : 'Merci pour ton avis !');
            if (value === 'unclear' && withComment === undefined) setCommentOpen(true);
        } catch (error) {
            notify((error as Error).message, 'error');
        }
    };

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            <button
                type="button"
                onClick={toggleFavorite}
                aria-pressed={favorite}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition', favorite ? 'border-danger/40 bg-danger/10 text-danger' : 'border-line hover:border-danger/40')}
            >
                <Heart className={cn('size-4', favorite && 'fill-current')} aria-hidden /> {favorite ? 'En favori' : 'Favori'}
            </button>
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
            <span className="text-xs text-muted-foreground">Ce contenu t’a aidé ?</span>
            <button
                type="button"
                onClick={() => rate('useful')}
                aria-pressed={rating?.value === 'useful'}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition', rating?.value === 'useful' ? 'border-ok/50 bg-ok/10 text-ok' : 'border-line hover:border-ok/40')}
            >
                <ThumbsUp className="size-4" aria-hidden /> Utile
            </button>
            <button
                type="button"
                onClick={() => rate('unclear')}
                aria-pressed={rating?.value === 'unclear'}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition', rating?.value === 'unclear' ? 'border-warn/50 bg-warn/10 text-warn' : 'border-line hover:border-warn/40')}
            >
                <ThumbsDown className="size-4" aria-hidden /> Pas encore clair
            </button>
            {rating && (
                <button type="button" onClick={() => setCommentOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <MessageSquareText className="size-3.5" aria-hidden /> {rating.comment ? 'Modifier mon commentaire' : 'Ajouter un commentaire'}
                </button>
            )}
            <button type="button" onClick={() => setReportOpen(true)} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Flag className="size-3.5" aria-hidden /> Signaler un problème
            </button>

            <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Qu’est-ce qui pourrait être amélioré ?</DialogTitle>
                        <DialogDescription>Facultatif. Ton commentaire est lu par l’équipe et n’est jamais publié.</DialogDescription>
                    </DialogHeader>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={4} className={inputClass} placeholder="Ex. : je n’ai pas compris pourquoi le port change à l’étape 5." />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setCommentOpen(false)} className="rounded-xl border border-line px-4 py-2 text-sm">
                            Plus tard
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCommentOpen(false);
                                rate(rating?.value ?? 'unclear', comment.trim());
                            }}
                            className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-accent"
                        >
                            Envoyer
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
            <ReportDialog open={reportOpen} onOpenChange={setReportOpen} subjectType={subjectType ?? type} slug={slug} />
        </div>
    );
}

export function ReportDialog({ open, onOpenChange, subjectType, slug, defaultCategory = 'explication' }: { open: boolean; onOpenChange: (open: boolean) => void; subjectType?: string; slug?: string; defaultCategory?: string }) {
    const { notify } = useToast();
    const [category, setCategory] = useState(defaultCategory);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setSending(true);
        setError(null);
        try {
            await sendJson('POST', '/api/retours', { category, subject_type: subjectType ?? null, subject_slug: slug ?? null, page_url: window.location.pathname, message });
            notify('Merci ! Ton signalement a été transmis à l’équipe.');
            setMessage('');
            onOpenChange(false);
        } catch (caught) {
            setError((caught as Error).message);
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Signaler un problème</DialogTitle>
                    <DialogDescription>Ton message est transmis à l’équipe et n’est jamais publié automatiquement.</DialogDescription>
                </DialogHeader>
                <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Type de problème</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                        {Object.entries(CATEGORIES).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Décris ce que tu as constaté</span>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} className={inputClass} placeholder="Ex. : à l’étape 7, le texte parle du port 443 mais le schéma montre 80." />
                </label>
                {error && (
                    <p className="text-sm text-danger" role="alert">
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border border-line px-4 py-2 text-sm">
                        Annuler
                    </button>
                    <button type="button" disabled={sending || message.trim().length < 5} onClick={submit} className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">
                        {sending ? 'Envoi…' : 'Envoyer'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
