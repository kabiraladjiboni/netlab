<?php

namespace App\Support\Security;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Journal des événements de sécurité (OWASP A09) : connexions, échecs, verrouillages,
 * double authentification, changements de mot de passe ou de rôle.
 *
 * Jamais de mot de passe, de code ni de jeton. L'adresse IP n'est pas conservée en clair :
 * seule une empreinte (HMAC avec la clé de l'application) permet de relier des tentatives
 * venant d'une même source. Fichier : storage/logs/security-AAAA-MM-JJ.log (90 jours).
 */
final class SecurityLog
{
    /** @param  array<string, scalar|null>  $context */
    public static function record(string $event, ?User $user = null, ?Request $request = null, array $context = [], string $level = 'info'): void
    {
        $request ??= request();
        Log::channel('security')->log($level, $event, [
            'user_id' => $user?->id,
            'ip_hash' => self::ipHash($request->ip()),
            'route' => $request->route()?->getName(),
            ...$context,
        ]);
    }

    public static function ipHash(?string $ip): ?string
    {
        if ($ip === null) {
            return null;
        }

        return substr(hash_hmac('sha256', $ip, (string) config('app.key')), 0, 16);
    }

    /** Empreinte d'une adresse e-mail saisie (échecs de connexion sans compte). */
    public static function emailHash(string $email): string
    {
        return substr(hash_hmac('sha256', mb_strtolower(trim($email)), (string) config('app.key')), 0, 16);
    }
}
