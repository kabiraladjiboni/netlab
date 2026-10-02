<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

class VerifyEmailFr extends VerifyEmail
{
    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirme ton adresse e-mail')
            ->greeting('Bienvenue dans la communauté Abòrò !')
            ->line('Clique sur le bouton ci-dessous pour confirmer ton adresse e-mail et accéder aux travaux pratiques.')
            ->action('Confirmer mon adresse', $url)
            ->line("Ce lien expire dans 60 minutes. Si tu n'as pas créé de compte, ignore simplement ce message.")
            ->salutation('— L’équipe '.app(\App\Services\Platform\Settings::class)->platformName());
    }
}
