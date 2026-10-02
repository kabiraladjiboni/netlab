import { Head, Link, router } from '@inertiajs/react';
import { Heart, X } from 'lucide-react';
import { EmptyState } from '@/components/admin/ui';
import { useToast } from '@/components/layout/flash-toaster';
import { StudentShell } from '@/components/learning/student-shell';
import { sendJson } from '@/lib/api';
import { formatDate } from '@/lib/format';

type Favorite = { type: string; slug: string; title: string; href: string | null; exists: boolean; date: string };
const TYPES: Record<string, string> = { lesson: 'Leçon', protocol: 'Fiche protocole', lab: 'TP' };

export default function Favorites({ favorites }: { favorites: Favorite[] }) {
    const { notify } = useToast();
    const remove = async (favorite: Favorite) => {
        try {
            await sendJson('POST', '/api/favoris', { type: favorite.type, slug: favorite.slug });
            notify('Retiré de tes favoris.');
            router.reload({ only: ['favorites'] });
        } catch (error) {
            notify((error as Error).message, 'error');
        }
    };
    return (
        <StudentShell title="Mes favoris" description="Les contenus que tu as mis de côté.">
            <Head title="Mes favoris" />
            {favorites.length === 0 ? (
                <div className="rounded-3xl border border-line bg-surface">
                    <EmptyState icon={Heart} title="Aucun favori pour l’instant">
                        Sur une leçon, une fiche protocole ou un TP, clique sur « Favori » pour le retrouver ici.
                    </EmptyState>
                </div>
            ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {favorites.map((favorite) => (
                        <li key={`${favorite.type}-${favorite.slug}`} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                            <Heart className="mt-0.5 size-4 shrink-0 fill-current text-danger" aria-hidden />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground">
                                    {TYPES[favorite.type] ?? favorite.type} · ajouté le {formatDate(favorite.date)}
                                </p>
                                {favorite.href ? (
                                    <Link href={favorite.href} className="font-medium hover:text-signal">
                                        {favorite.title}
                                    </Link>
                                ) : (
                                    <p className="font-medium text-muted-foreground">{favorite.title} (contenu retiré)</p>
                                )}
                            </div>
                            <button type="button" onClick={() => remove(favorite)} className="text-muted-foreground hover:text-danger" aria-label={`Retirer ${favorite.title} des favoris`}>
                                <X className="size-4" aria-hidden />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </StudentShell>
    );
}
