<?php

namespace App\Http\Middleware;

use App\Services\Platform\Settings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Accès aux TP : compte requis (middleware « auth » placé avant), puis
 * adresse e-mail vérifiée si ce réglage est actif.
 */
class EnsureLabAccess
{
    public function __construct(private readonly Settings $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null) {
            return $request->expectsJson() ? abort(401) : redirect()->guest(route('login'));
        }
        if ($this->settings->get('accounts.require_verification') && ! $user->hasVerifiedEmail() && ! $user->isAdmin()) {
            if ($request->expectsJson()) {
                abort(403, 'Confirme ton adresse e-mail pour accéder aux TP.');
            }
            if ($request->isMethod('GET')) {
                $request->session()->put('url.intended', $request->fullUrl());
            }

            return redirect()->route('verification.notice');
        }

        return $next($request);
    }
}
