<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureLabAccess;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\TrackActivity;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            EnsureAccountIsActive::class,
            HandleInertiaRequests::class,
            TrackActivity::class,
        ]);
        // En-têtes de sécurité sur toutes les réponses, y compris les pages d'erreur.
        $middleware->append(SecurityHeaders::class);
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'lab' => EnsureLabAccess::class,
        ]);
        // Production : seules les requêtes adressées au domaine d'APP_URL sont acceptées
        // (protège les liens générés contre les en-têtes Host forgés).
        $middleware->trustHosts(
            at: fn () => config('app.env') === 'production' ? array_filter([parse_url((string) config('app.url'), PHP_URL_HOST)]) : [],
            subdomains: false,
        );
        // Le contrôle « administrateur » passe AVANT la résolution des modèles de route :
        // un étudiant reçoit 403 sur /admin/utilisateurs/{id}, que l'identifiant existe ou non
        // (pas d'énumération des comptes par la différence 403 / 404).
        $middleware->prependToPriorityList(\Illuminate\Routing\Middleware\SubstituteBindings::class, EnsureUserIsAdmin::class);
        $middleware->prependToPriorityList(\Illuminate\Routing\Middleware\SubstituteBindings::class, \App\Http\Middleware\RequireAdminTwoFactor::class);
        $middleware->redirectGuestsTo(fn () => route('login'));
        $middleware->redirectUsersTo(fn () => route('student.dashboard'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
