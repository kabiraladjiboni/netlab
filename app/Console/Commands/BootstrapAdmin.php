<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Platform\AdminLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Premier administrateur sur un hébergement sans accès console (Render gratuit, etc.).
 *
 * Lit NETLAB_ADMIN_EMAIL et NETLAB_ADMIN_PASSWORD, et n'agit QUE s'il n'existe encore
 * aucun administrateur : relancer le conteneur ne recrée ni ne modifie jamais un compte.
 * Après la première connexion, supprime NETLAB_ADMIN_PASSWORD des variables de l'hébergeur ;
 * la double authentification est ensuite exigée pour entrer dans l'administration.
 */
class BootstrapAdmin extends Command
{
    protected $signature = 'netlab:bootstrap-admin';

    protected $description = 'Crée le premier administrateur depuis NETLAB_ADMIN_EMAIL / NETLAB_ADMIN_PASSWORD (si aucun n’existe)';

    public function handle(AdminLogger $logger): int
    {
        if (User::where('role', User::ROLE_ADMIN)->exists()) {
            $this->line('Un administrateur existe déjà : rien à faire.');

            return self::SUCCESS;
        }
        $email = Str::lower(trim((string) env('NETLAB_ADMIN_EMAIL', '')));
        $password = (string) env('NETLAB_ADMIN_PASSWORD', '');
        if ($email === '' || $password === '') {
            $this->warn('Aucun administrateur : définis NETLAB_ADMIN_EMAIL et NETLAB_ADMIN_PASSWORD puis redémarre.');

            return self::SUCCESS;
        }
        $validator = Validator::make(['email' => $email, 'password' => $password], [
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', Password::defaults()],
        ]);
        if ($validator->fails()) {
            // Les messages ne contiennent jamais le mot de passe lui-même.
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first() ?? User::create(['name' => 'Administrateur', 'email' => $email, 'password' => $password]);
        $user->forceFill(['role' => User::ROLE_ADMIN, 'email_verified_at' => $user->email_verified_at ?? now(), 'terms_accepted_at' => $user->terms_accepted_at ?? now()])->save();
        $logger->log(null, 'user.admin_created', 'user', $email, ['via' => 'bootstrap']);
        $this->info("Administrateur créé : {$email}. Supprime maintenant NETLAB_ADMIN_PASSWORD des variables de l’hébergeur.");

        return self::SUCCESS;
    }
}
