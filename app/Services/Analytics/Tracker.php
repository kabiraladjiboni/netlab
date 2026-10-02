<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsEvent;
use App\Models\User;
use App\Models\VisitorSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Collecte des événements d'usage, avec minimisation des données.
 *
 * Règles (documentées dans la politique de confidentialité) :
 *  - aucune adresse IP n'est stockée ;
 *  - visiteur NON connecté sans consentement : seuls des compteurs anonymes
 *    (type d'événement, page, date) sont enregistrés, sans identifiant ni pays ;
 *  - visiteur ayant accepté la mesure d'audience : identifiant de session
 *    aléatoire, empreinte de visiteur hachée avec un sel renouvelé chaque jour
 *    (impossible de suivre quelqu'un d'un jour à l'autre) et pays estimé ;
 *  - étudiant connecté : ses activités pédagogiques sont liées à son compte
 *    (c'est le service rendu : progression, historique) ; le pays n'est estimé
 *    que s'il a accepté la mesure d'audience.
 */
class Tracker
{
    public const CONSENT_COOKIE = 'netlab_consent';

    private const SESSION_KEY = 'analytics.sid';

    public function __construct(private readonly GeoIp $geo) {}

    public function consent(Request $request): ?string
    {
        $value = $request->cookie(self::CONSENT_COOKIE);

        return in_array($value, ['granted', 'denied'], true) ? $value : null;
    }

    public function consentGranted(Request $request): bool
    {
        return $this->consent($request) === 'granted';
    }

    /** La session peut-elle être suivie (présence, durée) ? */
    public function tracked(Request $request): bool
    {
        return $request->hasSession() && ($request->user() !== null || $this->consentGranted($request));
    }

    public function sessionHash(Request $request): ?string
    {
        if (! $this->tracked($request)) {
            return null;
        }
        $sid = $request->session()->get(self::SESSION_KEY);
        if (! is_string($sid)) {
            $sid = Str::random(40);
            $request->session()->put(self::SESSION_KEY, $sid);
        }

        return hash('sha256', $sid);
    }

    public function visitorHash(Request $request): ?string
    {
        if (! $this->consentGranted($request)) {
            return null;
        }
        $salt = Cache::remember('analytics.salt.'.now()->format('Ymd'), now()->addDays(2), fn () => bin2hex(random_bytes(16)));

        return hash('sha256', $salt.'|'.$request->ip().'|'.substr((string) $request->userAgent(), 0, 200));
    }

    /** Signal d'activité (page affichée ou battement de présence). */
    public function touch(Request $request): ?VisitorSession
    {
        $user = $request->user();
        if ($user !== null && ($user->last_active_at === null || $user->last_active_at->lt(now()->subMinute()))) {
            $user->forceFill(['last_active_at' => now()])->saveQuietly();
        }

        $hash = $this->sessionHash($request);
        if ($hash === null) {
            return null;
        }

        $session = VisitorSession::query()->where('session_hash', $hash)->first();
        if ($session === null) {
            return VisitorSession::create([
                'session_hash' => $hash,
                'visitor_hash' => $this->visitorHash($request),
                'user_id' => $user?->id,
                'country' => $this->consentGranted($request) ? $this->geo->country($request) : null,
                'signals' => 1,
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]);
        }

        $session->forceFill([
            'last_seen_at' => now(),
            'signals' => $session->signals + 1,
            'user_id' => $session->user_id ?? $user?->id,
        ])->save();

        return $session;
    }

    public function linkSessionToUser(Request $request, User $user): void
    {
        $hash = $this->sessionHash($request);
        if ($hash !== null) {
            VisitorSession::query()->where('session_hash', $hash)->update(['user_id' => $user->id]);
        }
    }

    /**
     * Enregistre un événement.
     *
     * @param  array<string, mixed>|null  $meta  données complémentaires minimales (jamais de donnée personnelle)
     */
    public function record(Request $request, string $type, ?string $subjectType = null, ?string $subjectSlug = null, ?int $value = null, ?array $meta = null): AnalyticsEvent
    {
        $sessionHash = $this->sessionHash($request);
        $country = null;
        if ($sessionHash !== null && $this->consentGranted($request)) {
            $country = VisitorSession::query()->where('session_hash', $sessionHash)->value('country');
        }

        return AnalyticsEvent::create([
            'type' => $type,
            'occurred_at' => now(),
            'user_id' => $request->user()?->id,
            'session_hash' => $sessionHash,
            'visitor_hash' => $this->visitorHash($request),
            'subject_type' => $subjectType,
            'subject_slug' => $subjectSlug !== null ? mb_substr($subjectSlug, 0, 190) : null,
            'value' => $value,
            'meta' => $meta,
            'country' => $country,
        ]);
    }

    /**
     * Enregistre au plus une fois par session et par jour (consultations).
     * Sans session suivie, la déduplication se fait dans la session Laravel.
     */
    public function recordOnce(Request $request, string $type, string $subjectType, string $slug): void
    {
        if (! $request->hasSession()) {
            return;
        }
        $key = 'analytics.seen.'.now()->format('Ymd').'.'.$type.'.'.$subjectType.'.'.$slug;
        if ($request->session()->has($key)) {
            return;
        }
        $request->session()->put($key, true);
        $this->record($request, $type, $subjectType, $slug);
    }

    /** Requête de recherche : masquée si elle ressemble à une donnée personnelle. */
    public static function sanitizeQuery(string $query): string
    {
        $query = mb_strtolower(trim(preg_replace('/\s+/', ' ', $query)));
        if (str_contains($query, '@') || preg_match('/\d{6,}/', $query)) {
            return '[masqué]';
        }

        return mb_substr($query, 0, 60);
    }
}
