<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Vérifie la configuration de sécurité avant (et après) une mise en ligne.
 * Ne modifie rien : affiche ce qui est conforme, à corriger, ou à vérifier à la main.
 */
class SecurityCheck extends Command
{
    protected $signature = 'netlab:security-check';

    protected $description = 'Contrôle la configuration de sécurité (production)';

    public function handle(): int
    {
        $production = app()->isProduction();
        $https = str_starts_with((string) config('app.url'), 'https://');
        $admins = User::where('role', User::ROLE_ADMIN)->get();
        $adminsWithout2fa = $admins->reject(fn (User $user) => $user->hasTwoFactor())->count();
        $mailer = (string) config('mail.default');

        $checks = [
            ['Environnement', $production, 'APP_ENV=production', 'APP_ENV='.app()->environment().' (normal en local)'],
            ['Mode débogage désactivé', ! config('app.debug'), 'APP_DEBUG=false', 'APP_DEBUG=true : les erreurs détaillées seraient visibles du public'],
            ['Clé d’application', filled(config('app.key')), 'APP_KEY définie', 'APP_KEY manquante : php artisan key:generate'],
            ['Adresse publique en HTTPS', $https, (string) config('app.url'), 'APP_URL doit commencer par https:// en production'],
            ['Cookie de session sécurisé', (bool) config('session.secure'), 'Secure', 'SESSION_SECURE_COOKIE=true (ou APP_URL en https)'],
            ['Cookie __Host-', str_starts_with((string) config('session.cookie'), '__Host-'), (string) config('session.cookie'), 'Actif automatiquement en production HTTPS'],
            ['Session chiffrée', (bool) config('session.encrypt'), 'SESSION_ENCRYPT=true', 'SESSION_ENCRYPT=false'],
            ['Content-Security-Policy', config('netlab.security.csp') === 'enforce', 'NETLAB_CSP=enforce', 'NETLAB_CSP='.config('netlab.security.csp')],
            ['2FA obligatoire pour l’administration', (bool) config('netlab.security.admin_two_factor'), 'NETLAB_ADMIN_2FA=true', 'NETLAB_ADMIN_2FA=false'],
            ['Administrateurs avec 2FA', $adminsWithout2fa === 0, $admins->count().' administrateur(s), tous protégés', $adminsWithout2fa.' administrateur(s) sans 2FA'],
            ['Mots de passe divulgués refusés', (bool) config('netlab.security.breached_passwords'), 'NETLAB_BREACHED_PASSWORDS=true', 'Vérification désactivée'],
            ['Envoi réel des e-mails', ! in_array($mailer, ['log', 'array'], true), 'MAIL_MAILER='.$mailer, 'MAIL_MAILER='.$mailer.' : aucun e-mail ne part'],
            ['Journal sans détails de débogage', config('logging.channels.'.config('logging.default').'.level', 'debug') !== 'debug' || ! $production, 'LOG_LEVEL='.config('logging.channels.single.level', 'debug'), 'LOG_LEVEL=debug en production'],
            ['Fichier .env hors du dossier public', ! file_exists(public_path('.env')), 'OK', 'public/.env existe : supprime-le immédiatement'],
            ['Serveur SSR local uniquement', in_array(parse_url((string) config('inertia.ssr.url'), PHP_URL_HOST), ['127.0.0.1', 'localhost', '::1'], true), (string) config('inertia.ssr.url'), 'INERTIA_SSR_URL doit pointer vers 127.0.0.1'],
        ];

        $failed = 0;
        $rows = [];
        foreach ($checks as [$label, $ok, $good, $bad]) {
            $critical = $production || in_array($label, ['Clé d’application', 'Fichier .env hors du dossier public'], true);
            if (! $ok && $critical) {
                $failed++;
            }
            $rows[] = [$ok ? '<fg=green>✔</>' : ($critical ? '<fg=red>✖</>' : '<fg=yellow>•</>'), $label, $ok ? $good : $bad];
        }
        $this->table(['', 'Contrôle', 'Détail'], $rows);
        $this->line('À faire aussi régulièrement : <comment>composer audit</comment> et <comment>npm audit</comment> (failles connues des dépendances).');

        if ($failed > 0) {
            $this->error("{$failed} point(s) à corriger avant une mise en ligne.");

            return self::FAILURE;
        }
        $this->info($production ? 'Configuration de production conforme.' : 'Environnement local : les points en jaune sont normaux ici, mais à corriger en production.');

        return self::SUCCESS;
    }
}
