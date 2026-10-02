<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Platform\AdminLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Création sécurisée du compte administrateur : exécutée sur le serveur,
 * mot de passe saisi de manière masquée (jamais codé en dur ni passé en argument).
 */
class MakeAdmin extends Command
{
    protected $signature = 'netlab:admin {email : Adresse e-mail du compte} {--name= : Nom affiché (nouveau compte)} {--demote : Retirer le rôle administrateur}';

    protected $description = 'Crée un compte administrateur, promeut un compte existant ou retire ce rôle.';

    public function handle(AdminLogger $logger): int
    {
        $email = Str::lower(trim($this->argument('email')));
        if (Validator::make(['email' => $email], ['email' => 'required|email'])->fails()) {
            $this->error('Adresse e-mail invalide.');

            return self::FAILURE;
        }
        $user = User::where('email', $email)->first();

        if ($this->option('demote')) {
            if (! $user?->isAdmin()) {
                $this->error('Aucun administrateur avec cette adresse.');

                return self::FAILURE;
            }
            if (User::where('role', User::ROLE_ADMIN)->count() <= 1) {
                $this->error('Impossible : c’est le dernier administrateur.');

                return self::FAILURE;
            }
            $user->forceFill(['role' => User::ROLE_STUDENT])->save();
            $logger->log(null, 'user.role_changed', 'user', $user->email, ['role' => 'student', 'via' => 'console']);
            $this->info("{$email} n’est plus administrateur.");

            return self::SUCCESS;
        }

        if ($user !== null) {
            if ($user->isAdmin()) {
                $this->info('Ce compte est déjà administrateur.');

                return self::SUCCESS;
            }
            if (! $this->confirm("Promouvoir {$user->name} <{$email}> administrateur ?", true)) {
                return self::FAILURE;
            }
            $user->forceFill(['role' => User::ROLE_ADMIN])->save();
            $logger->log(null, 'user.role_changed', 'user', $user->email, ['role' => 'admin', 'via' => 'console']);
            $this->info('Compte promu administrateur.');

            return self::SUCCESS;
        }

        $name = $this->option('name') ?: $this->ask('Nom affiché', 'Administrateur');
        $password = $this->secret('Mot de passe (12 caractères minimum, une phrase de passe est idéale)');
        $confirmation = $this->secret('Confirme le mot de passe');
        $validator = Validator::make(
            ['password' => $password, 'password_confirmation' => $confirmation],
            ['password' => ['required', 'confirmed', Password::defaults()]],
        );
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $user = User::create(['name' => $name, 'email' => $email, 'password' => $password]);
        $user->forceFill(['role' => User::ROLE_ADMIN, 'email_verified_at' => now(), 'terms_accepted_at' => now()])->save();
        $logger->log(null, 'user.admin_created', 'user', $email, ['via' => 'console']);
        $this->info("Administrateur créé : {$email}. Connecte-toi sur /connexion.");

        return self::SUCCESS;
    }
}
