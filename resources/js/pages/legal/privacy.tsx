import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useShared } from '@/hooks/use-auth';

function Part({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <div className="space-y-2 text-[15px] leading-relaxed text-foreground/90 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
        </section>
    );
}

/**
 * Politique de confidentialité : décrit ce que la plateforme fait RÉELLEMENT
 * (voir App\Services\Analytics\Tracker et les migrations).
 */
export default function Privacy({ retentionDays, presenceWindow, contact }: { retentionDays: number; presenceWindow: number; contact: string | null }) {
    const { app, consent } = useShared();
    return (
        <>
            <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
                <header>
                    <p className="text-xs font-semibold tracking-[0.16em] text-signal uppercase">Confidentialité</p>
                    <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Politique de confidentialité</h1>
                    <p className="mt-3 text-muted-foreground">
                        {app.name} est une plateforme éducative gratuite. Nous collectons le minimum nécessaire pour faire fonctionner ton compte, sauvegarder ta progression et améliorer les cours. Aucune publicité, aucun traceur tiers, aucune revente de données.
                    </p>
                </header>

                <Part title="1. Données de ton compte">
                    <ul>
                        <li>Nom affiché, adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée irréversible, jamais lisible par l’équipe).</li>
                        <li>Pays, uniquement si tu choisis de l’indiquer dans ton profil.</li>
                        <li>Date d’acceptation des conditions, date de dernière activité, préférences d’affichage.</li>
                    </ul>
                    <p>Nous ne demandons ni numéro de téléphone, ni adresse postale, ni moyen de paiement.</p>
                </Part>

                <Part title="2. Données pédagogiques">
                    <p>Pour te permettre de reprendre un TP et de suivre tes résultats, nous enregistrons, liées à ton compte : les étapes vues dans chaque TP, le temps actif approximatif, tes réponses et scores aux quiz, tes essais et indices utilisés dans les diagnostics, les chapitres consultés, tes favoris, tes évaluations et les signalements que tu envoies.</p>
                    <p>Ces données sont le service lui-même : elles sont conservées tant que ton compte existe et supprimées avec lui.</p>
                </Part>

                <Part title="3. Mesure d’audience">
                    <p>Sans ton accord, nous comptons seulement des pages vues, sans identifiant ni localisation.</p>
                    <p>Si tu acceptes la mesure d’audience (ou si tu es connecté), nous utilisons en plus :</p>
                    <ul>
                        <li>un identifiant de session aléatoire, pour estimer combien de personnes sont actives (session ayant envoyé un signal dans les {presenceWindow} dernières minutes, onglet visible et utilisé) ;</li>
                        <li>une empreinte de visiteur calculée avec un code secret renouvelé chaque jour, ce qui empêche de te reconnaître d’un jour à l’autre ;</li>
                        <li>uniquement si tu as accepté : un <strong>pays estimé</strong> à partir de ton adresse IP. L’adresse IP sert à ce calcul puis est oubliée : elle n’est jamais enregistrée. Le pays peut être faux (VPN, réseau mobile…).</li>
                    </ul>
                    <p>
                        Ces données de mesure sont automatiquement supprimées après <strong>{retentionDays} jours</strong>. Ton choix actuel : <strong>{consent === 'granted' ? 'accepté' : consent === 'denied' ? 'refusé' : 'pas encore exprimé'}</strong>. Il est conservé 6 mois ; pour le modifier, efface le cookie « netlab_consent » de ton navigateur.
                    </p>
                </Part>

                <Part title="4. Cookies">
                    <ul>
                        <li>Cookie de session et jeton de sécurité (CSRF) : indispensables au fonctionnement et à la connexion.</li>
                        <li>Cookie « netlab_consent » : mémorise ton choix pour la mesure d’audience.</li>
                        <li>Le stockage local de ton navigateur garde tes préférences d’affichage (thème, niveau d’explication). Il ne quitte pas ton appareil.</li>
                    </ul>
                </Part>

                <Part title="5. Assistant pédagogique">
                    <p>
                        Les questions posées à l’assistant servent uniquement à te répondre. {app.ai_enabled ? 'Elles peuvent être transmises au fournisseur d’intelligence artificielle configuré par l’équipe, sans ton nom ni ton adresse e-mail.' : 'Dans la configuration actuelle, elles sont traitées sur nos serveurs, sans service tiers.'} Elles ne sont pas enregistrées dans ton historique.
                    </p>
                </Part>

                <Part title="6. Qui a accès à tes données ?">
                    <p>Seuls les administrateurs de la plateforme, dans la limite de ce qui est utile à son fonctionnement : liste des comptes, état de vérification, progression agrégée, signalements. Les actions sensibles des administrateurs (suspension, suppression, export…) sont consignées dans un journal.</p>
                </Part>

                <Part title="7. Tes droits">
                    <ul>
                        <li>
                            <strong>Accès et portabilité</strong> : télécharge toutes tes données depuis{' '}
                            <Link href="/app/parametres" className="text-signal hover:underline">
                                Paramètres
                            </Link>
                            .
                        </li>
                        <li>
                            <strong>Rectification</strong> : modifie ton nom, ton adresse ou ton pays depuis ton{' '}
                            <Link href="/app/mon-profil" className="text-signal hover:underline">
                                profil
                            </Link>
                            .
                        </li>
                        <li>
                            <strong>Effacement</strong> : supprime ton compte et toutes tes données pédagogiques à tout moment depuis Paramètres. Les mesures d’audience déjà agrégées deviennent anonymes.
                        </li>
                        <li>Pour toute autre demande{contact ? <> : <a href={`mailto:${contact}`} className="text-signal hover:underline">{contact}</a></> : ', utilise l’adresse de contact indiquée en bas de page'}.</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">Selon ton pays, tu peux aussi saisir l’autorité de protection des données compétente (au Bénin : l’Autorité de Protection des Données à caractère Personnel, APDP).</p>
                </Part>
            </article>
        </>
    );
}
