<?php

namespace App\Http\Middleware;

use App\Services\Platform\Settings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * En-têtes de sécurité (OWASP Secure Headers Project) appliqués à toutes les réponses web.
 *
 * - Content-Security-Policy avec nonce : seuls les scripts de la plateforme s'exécutent
 *   (aucun script tiers, aucun script injecté). Mode réglable par NETLAB_CSP :
 *   « enforce » (défaut), « report » (journalise sans bloquer) ou « off ».
 * - HSTS en production derrière HTTPS, anti-clickjacking, isolation d'origine,
 *   désactivation des API sensibles du navigateur, pas de cache pour les pages privées.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $mode = (string) config('netlab.security.csp', 'enforce');
        $nonce = null;
        if ($mode !== 'off') {
            // Le nonce est ajouté par Laravel aux balises <script> et <link> générées par @vite.
            $nonce = Vite::useCspNonce();
        }

        $response = $next($request);
        $headers = $response->headers;

        if ($nonce !== null) {
            $headers->set($mode === 'report' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', $this->policy($nonce));
        }

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', 'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), interest-cohort=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $headers->set('Cross-Origin-Resource-Policy', 'same-origin');
        $headers->set('X-Permitted-Cross-Domain-Policies', 'none');
        $headers->remove('X-Powered-By');
        if (function_exists('header_remove') && ! app()->runningUnitTests()) {
            header_remove('X-Powered-By');
        }

        if ($request->isSecure() && app()->isProduction()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Pages personnelles ou d'administration : jamais conservées par un cache partagé ou le navigateur.
        if ($request->user() !== null || $request->is('admin', 'admin/*', 'app', 'app/*')) {
            $headers->set('Cache-Control', 'no-store, private');
        }

        if (! app()->isProduction()) {
            // Un environnement de test ou local ne doit jamais apparaître dans un moteur de recherche.
            $headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $response;
    }

    private function policy(string $nonce): string
    {
        $self = "'self'";
        $script = [$self, "'nonce-{$nonce}'"];
        $style = [$self, "'unsafe-inline'"]; // attributs style (animations, rendu serveur) : risque faible, pas d'exécution de code
        $connect = [$self];
        $img = [$self, 'data:', 'blob:'];
        $font = [$self, 'data:'];

        // Logo hébergé ailleurs (réglage administrateur) : seul son hôte est autorisé.
        $logo = (string) app(Settings::class)->get('platform.logo_url');
        if (str_starts_with($logo, 'https://') && ($host = parse_url($logo, PHP_URL_HOST))) {
            $img[] = 'https://'.$host;
        }

        // Serveur de développement Vite (npm run dev) : uniquement en local.
        if (Vite::isRunningHot()) {
            $hot = rtrim((string) @file_get_contents(public_path('hot')), "/\n ");
            if ($hot !== '') {
                $ws = preg_replace('#^http#', 'ws', $hot);
                array_push($script, $hot);
                array_push($style, $hot);
                array_push($connect, $hot, $ws);
                array_push($img, $hot);
                array_push($font, $hot);
            }
        }

        $directives = [
            'default-src' => [$self],
            'script-src' => $script,
            'style-src' => $style,
            'img-src' => $img,
            'font-src' => $font,
            'connect-src' => $connect,
            'worker-src' => [$self, 'blob:'],
            'manifest-src' => [$self],
            'media-src' => [$self],
            'object-src' => ["'none'"],
            'base-uri' => [$self],
            'form-action' => [$self],
            'frame-src' => ["'none'"],
            'frame-ancestors' => ["'none'"],
        ];

        $policy = collect($directives)->map(fn (array $values, string $name) => $name.' '.implode(' ', array_unique($values)))->implode('; ');
        if (app()->isProduction() && str_starts_with((string) config('app.url'), 'https://')) {
            $policy .= '; upgrade-insecure-requests';
        }

        return $policy;
    }
}
