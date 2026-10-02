import { useShared } from '@/hooks/use-auth';

export default function Terms({ contact }: { contact: string | null }) {
    const { app } = useShared();
    const items: [string, string][] = [
        ['Objet', `${app.name} est une plateforme éducative gratuite d’apprentissage des réseaux informatiques. Les cours sont accessibles sans compte ; un compte gratuit permet de manipuler les travaux pratiques et de conserver sa progression.`],
        ['Gratuité', 'L’inscription et l’utilisation des TP sont gratuites dans cette version. Aucun moyen de paiement n’est demandé.'],
        ['Compte', 'Tu t’engages à fournir une adresse e-mail valide, à garder ton mot de passe confidentiel et à ne créer qu’un compte pour ton usage personnel.'],
        ['Contenus pédagogiques', 'Les animations sont des scénarios pédagogiques déterministes : elles illustrent le fonctionnement des protocoles mais ne simulent pas un réseau réel. Les valeurs affichées (adresses, ports, tailles) sont illustratives. Malgré nos vérifications, une erreur reste possible : utilise « Signaler un problème » pour nous aider à la corriger.'],
        ['Usage responsable', 'Les connaissances présentées (captures, diagnostic) doivent être utilisées sur des réseaux qui t’appartiennent ou avec une autorisation explicite. Toute tentative de perturber la plateforme, d’accéder aux données d’autrui ou d’automatiser des requêtes abusives peut entraîner la suspension du compte.'],
        ['Commentaires et signalements', 'Tes commentaires sont lus par l’équipe et ne sont jamais publiés automatiquement. Ils doivent rester respectueux.'],
        ['Suspension et suppression', 'Un compte peut être suspendu en cas d’abus. Tu peux supprimer ton compte à tout moment depuis tes paramètres.'],
        ['Évolution', 'Ces conditions peuvent évoluer ; la date de ton acceptation est conservée avec ton compte.'],
    ];
    return (
        <>
            <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
                <h1 className="font-display text-3xl font-semibold sm:text-4xl">Conditions d’utilisation</h1>
                {items.map(([title, text], index) => (
                    <section key={title}>
                        <h2 className="font-display text-lg font-semibold">
                            {index + 1}. {title}
                        </h2>
                        <p className="mt-1 leading-relaxed text-foreground/90">{text}</p>
                    </section>
                ))}
                {contact && (
                    <p className="text-sm text-muted-foreground">
                        Contact : <a href={`mailto:${contact}`} className="text-signal hover:underline">{contact}</a>
                    </p>
                )}
            </article>
        </>
    );
}
