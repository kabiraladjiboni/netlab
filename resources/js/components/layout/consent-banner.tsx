import { Link, router, usePage } from '@inertiajs/react';
import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { sendJson } from '@/lib/api';
import type { SharedProps } from '@/types/shared';

/**
 * Choix explicite pour la mesure d'audience (pays estimé, visiteurs uniques,
 * présence). Sans réponse, rien de tout cela n'est collecté : le consentement
 * n'est jamais présumé. Le choix est conservé 6 mois.
 */
export function ConsentBanner() {
    const { consent, app } = usePage<SharedProps>().props;
    const [hidden, setHidden] = useState(false);
    if (consent !== null || hidden) return null;

    const choose = async (choice: 'granted' | 'denied') => {
        setHidden(true);
        try {
            await sendJson('POST', '/api/consentement', { choice });
            router.reload({ only: ['consent'] });
        } catch {
            /* le bandeau réapparaîtra à la prochaine page */
        }
    };

    return (
        <div className="fixed inset-x-0 bottom-0 z-[65] p-3 sm:p-4" role="region" aria-label="Mesure d’audience">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-line bg-popover p-4 shadow-2xl shadow-[var(--shadow-color)] sm:flex-row sm:items-center">
                <BarChart3 className="hidden size-6 shrink-0 text-signal sm:block" aria-hidden />
                <p className="flex-1 text-sm leading-relaxed">
                    Pour améliorer les cours, nous aimerions mesurer l’audience de façon <strong>anonyme</strong> (pays estimé, nombre de visiteurs). Aucune publicité, aucun traceur tiers.{' '}
                    <Link href={app.privacy_url} className="text-signal underline-offset-2 hover:underline">
                        En savoir plus
                    </Link>
                </p>
                <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => choose('denied')} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-night-800">
                        Refuser
                    </button>
                    <button type="button" onClick={() => choose('granted')} className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-accent hover:brightness-110">
                        Accepter
                    </button>
                </div>
            </div>
        </div>
    );
}
