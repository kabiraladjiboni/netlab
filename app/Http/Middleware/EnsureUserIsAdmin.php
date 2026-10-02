<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Contrôle côté serveur : seul un administrateur accède à /admin. */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Accès réservé aux administrateurs.');

        return $next($request);
    }
}
