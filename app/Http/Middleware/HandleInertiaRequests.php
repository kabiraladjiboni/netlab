<?php

namespace App\Http\Middleware;

use App\Services\Analytics\Tracker;
use App\Services\Assistant\AssistantService;
use App\Services\Platform\Settings;
use App\Support\Seo\Seo;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    /**
     * Pages privées (espace étudiant, TP, administration) : rendues dans le navigateur.
     * Le rendu serveur ne sert qu'aux pages publiques, utiles au référencement.
     *
     * @var array<int, string>
     */
    protected $withoutSsr = ['app', 'app/*', 'admin', 'admin/*', 'laboratoire/*', 'email/*'];

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /** Espaces privés ou sans intérêt pour les moteurs de recherche. */
    public const PRIVATE_PATHS = ['admin', 'admin/*', 'app', 'app/*', 'laboratoire/*', 'connexion', 'inscription', 'mot-de-passe-oublie', 'reinitialiser-mot-de-passe/*', 'email/*'];

    /** @return array<int, string> */
    private function head(Request $request): array
    {
        $seo = app(Seo::class);
        if ($request->is(...self::PRIVATE_PATHS)) {
            $seo->noindex();
        }

        return $seo->tags();
    }

    /** @return array<string, mixed> */
    public function share(Request $request): array
    {
        $settings = app(Settings::class);

        return [
            ...parent::share($request),
            'app' => fn () => [
                'name' => $settings->platformName(),
                'slogan' => config('netlab.slogan'),
                'community' => config('netlab.community'),
                'community_motto' => config('netlab.community_motto'),
                'tagline' => $settings->get('platform.description') ?: config('netlab.tagline'),
                'logo_url' => $settings->get('platform.logo_url'),
                'ai_enabled' => app(AssistantService::class)->aiEnabled(),
                'assistant_enabled' => (bool) $settings->get('assistant.enabled'),
                'registration_open' => (bool) $settings->get('accounts.registration_open'),
                'lab_requires_verification' => (bool) $settings->get('accounts.require_verification'),
                'terms_url' => $settings->get('legal.terms_url') ?: '/conditions',
                'privacy_url' => $settings->get('legal.privacy_url') ?: '/confidentialite',
                'contact_email' => $settings->get('platform.contact_email'),
                'environment' => app()->environment(),
            ],
            'auth' => fn () => [
                'user' => $request->user()?->toSharedArray(),
            ],
            'flash' => fn () => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'consent' => fn () => app(Tracker::class)->consent($request),
            // Balises <head> (titre, description, Open Graph, données structurées) : voir App\Support\Seo\Seo.
            'head' => fn () => $this->head($request),
        ];
    }
}
