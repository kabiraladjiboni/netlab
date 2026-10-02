<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Security\SecurityLog;
use Illuminate\Console\Command;

/**
 * Secours : désactive la double authentification d'un compte (téléphone perdu et codes
 * de secours égarés). Réservé à qui a accès au serveur ; l'action est journalisée.
 */
class ResetTwoFactor extends Command
{
    protected $signature = 'netlab:2fa-reset {email : Adresse du compte}';

    protected $description = 'Désactive la double authentification d’un compte (procédure de secours)';

    public function handle(): int
    {
        $user = User::where('email', mb_strtolower((string) $this->argument('email')))->first();
        if ($user === null) {
            $this->error('Aucun compte avec cette adresse.');

            return self::FAILURE;
        }
        if (! $user->hasTwoFactor()) {
            $this->info('La double authentification n’est pas activée sur ce compte.');

            return self::SUCCESS;
        }
        if (! $this->confirm("Désactiver la double authentification de {$user->email} ? Vérifie d'abord l'identité de la personne.")) {
            return self::FAILURE;
        }
        $user->disableTwoFactor();
        SecurityLog::record('2fa.reset_by_console', $user, null, [], 'notice');
        $this->info('Double authentification désactivée. La personne devra la réactiver (obligatoire pour un administrateur).');

        return self::SUCCESS;
    }
}
