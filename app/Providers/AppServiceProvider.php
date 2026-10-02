<?php

namespace App\Providers;

use App\Services\Assistant\AssistantService;
use App\Services\Content\ContentRepository;
use App\Support\Security\SecurityLog;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Event;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ContentRepository::class, fn () => new ContentRepository(config('netlab.content_path')));
        $this->app->singleton(AssistantService::class, fn ($app) => AssistantService::fromConfig($app));
        $this->app->singleton(\App\Services\Platform\Settings::class);
        // Métadonnées de référencement : une instance par requête.
        $this->app->scoped(\App\Support\Seo\Seo::class);
    }

    public function boot(): void
    {
        // Mots de passe (OWASP ASVS 2.1) : longueur d'abord, sans règles de composition imposées,
        // 128 caractères maximum, et refus des mots de passe déjà divulgués lors de fuites.
        Password::defaults(function () {
            $rule = Password::min(12)->max(128);

            return config('netlab.security.breached_passwords') ? $rule->uncompromised() : $rule;
        });

        // Derrière le répartiteur de charge d'un hébergeur (Render, Koyeb…) : TRUSTED_PROXIES=*
        // pour que Laravel reconnaisse le HTTPS d'origine (cookies Secure, HSTS, liens https).
        if ($proxies = config('netlab.security.trusted_proxies')) {
            \Illuminate\Http\Middleware\TrustProxies::at($proxies);
        }

        // Production : liens générés en HTTPS lorsque l'adresse publique est en HTTPS.
        if ($this->app->isProduction() && str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
            // Liens (e-mails, redirections) toujours construits sur l'adresse officielle.
            URL::forceRootUrl((string) config('app.url'));
        }

        // L'assistant peut appeler une API payante : on limite le nombre de questions.
        RateLimiter::for('assistant', fn (Request $request) => [
            Limit::perMinute(12)->by($request->ip()),
            Limit::perDay(300)->by($request->ip()),
        ]);
        RateLimiter::for('search', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));

        // Comptes : limite les essais automatisés (en plus du verrouillage par e-mail du LoginController).
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(10)->by($request->ip()));
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));

        // Progression et présence : la sauvegarde est espacée côté client, ces limites sont des garde-fous.
        RateLimiter::for('learning', fn (Request $request) => Limit::perMinute(90)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('presence', fn (Request $request) => Limit::perMinute(6)->by($request->session()?->getId() ?: $request->ip()));
        RateLimiter::for('feedback', fn (Request $request) => Limit::perHour(15)->by($request->user()?->id ?: $request->ip()));

        // Journal de sécurité (OWASP A09) : jamais de mot de passe, d'IP en clair ni de jeton.
        Event::listen(Failed::class, fn (Failed $event) => SecurityLog::record('login.failed', $event->user, null, ['email_hash' => SecurityLog::emailHash((string) ($event->credentials['email'] ?? ''))], 'warning'));
        Event::listen(Lockout::class, fn (Lockout $event) => SecurityLog::record('login.lockout', null, $event->request, ['email_hash' => SecurityLog::emailHash((string) $event->request->input('email'))], 'warning'));
        Event::listen(Login::class, fn (Login $event) => SecurityLog::record('login.success', $event->user instanceof \App\Models\User ? $event->user : null, null, ['remember' => $event->remember]));
        Event::listen(Logout::class, fn (Logout $event) => SecurityLog::record('logout', $event->user instanceof \App\Models\User ? $event->user : null));
        Event::listen(PasswordReset::class, fn (PasswordReset $event) => SecurityLog::record('password.reset', $event->user instanceof \App\Models\User ? $event->user : null, null, [], 'notice'));
        Event::listen(Verified::class, fn (Verified $event) => SecurityLog::record('email.verified', $event->user instanceof \App\Models\User ? $event->user : null));

        // Accès complet aux données de l'administration.
        \Illuminate\Support\Facades\Gate::define('admin', fn (\App\Models\User $user) => $user->isAdmin());
    }
}
