<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Déconnecte immédiatement un compte suspendu, même avec une session ouverte. */
class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user !== null && $user->isSuspended()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            if ($request->expectsJson()) {
                abort(403, 'Compte suspendu.');
            }

            return redirect()->route('login')->withErrors(['email' => 'Ce compte est suspendu.']);
        }

        return $next($request);
    }
}
