<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordFr extends ResetPassword
{
    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject('Réinitialisation de ton mot de passe')
            ->line('Tu reçois ce message car une réinitialisation du mot de passe a été demandée pour ton compte.')
            ->action('Choisir un nouveau mot de passe', $url)
            ->line('Ce lien expire dans '.config('auth.passwords.users.expire').' minutes.')
            ->line("Si tu n'as rien demandé, aucune action n'est nécessaire : ton mot de passe reste inchangé.")
            ->salutation('— L’équipe '.app(\App\Services\Platform\Settings::class)->platformName());
    }
}
