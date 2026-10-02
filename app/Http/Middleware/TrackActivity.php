<?php

namespace App\Http\Middleware;

use App\Services\Analytics\Tracker;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Compte les pages affichées (hors administration et API) et met à jour la
 * présence. Échec silencieux : la mesure ne doit jamais casser une page.
 */
class TrackActivity
{
    public function __construct(private readonly Tracker $tracker) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethod('GET') || $response->getStatusCode() !== 200 || $request->is('admin*', 'api/*', 'up')) {
            return $response;
        }
        // Les rechargements partiels Inertia ne sont pas de nouvelles pages.
        if ($request->header('X-Inertia-Partial-Data')) {
            return $response;
        }

        try {
            $this->tracker->touch($request);
            $this->tracker->record($request, 'page_view', meta: ['route' => $request->route()?->getName()]);
        } catch (\Throwable $error) {
            report($error);
        }

        return $response;
    }
}
