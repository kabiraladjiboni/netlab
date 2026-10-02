<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;

/**
 * Conserve la destination initiale du visiteur (ex. un TP) pendant la
 * connexion ou l'inscription. Seuls les chemins internes sont acceptés,
 * pour éviter toute redirection ouverte vers un autre site.
 */
final class Intended
{
    public static function remember(Request $request): void
    {
        $target = $request->query('redirect');
        if (is_string($target) && self::isSafe($target)) {
            $request->session()->put('url.intended', url($target));
        }
    }

    public static function isSafe(string $path): bool
    {
        return str_starts_with($path, '/')
            && ! str_starts_with($path, '//')
            && ! str_contains($path, '\\')
            && ! preg_match('/[\x00-\x1F]/', $path)
            && strlen($path) <= 300;
    }

    /** Chemin de destination à afficher (« Tu seras redirigé vers… »). */
    public static function describe(Request $request): ?string
    {
        $url = $request->session()->get('url.intended');
        if (! is_string($url)) {
            return null;
        }
        $path = parse_url($url, PHP_URL_PATH) ?: '/';

        return str_starts_with($path, '/laboratoire') ? $path : null;
    }
}
