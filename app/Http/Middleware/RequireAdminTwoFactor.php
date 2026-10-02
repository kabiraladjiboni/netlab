<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Administration : double authentification obligatoire (NETLAB_ADMIN_2FA, activée par défaut).
 * Un administrateur sans 2FA est envoyé vers « Sécurité » pour l'activer, puis revient ici.
 */
class RequireAdminTwoFactor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user !== null && config('netlab.security.admin_two_factor') && ! $user->hasTwoFactor()) {
            if ($request->isMethod('GET')) {
                $request->session()->put('url.intended', $request->fullUrl());
            }

            return redirect()->route('student.security')
                ->with('error', 'La double authentification est obligatoire pour accéder à l’administration. Active-la ci-dessous : cela prend deux minutes.');
        }

        return $next($request);
    }
}
