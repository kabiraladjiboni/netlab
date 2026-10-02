<?php

namespace App\Services\Platform;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/**
 * Paramètres modifiables depuis l'administration.
 *
 * Ne contient AUCUN secret : les clés d'API et les réglages de sécurité
 * restent dans le fichier .env. Les valeurs par défaut ci-dessous
 * s'appliquent tant qu'un administrateur ne les a pas modifiées.
 */
class Settings
{
    /** @var array<string, array{default: mixed, rules: list<string>, label: string, group: string, help?: string}> */
    public const DEFINITIONS = [
        'platform.name' => ['default' => null, 'rules' => ['nullable', 'string', 'max:60'], 'label' => 'Nom de la plateforme', 'group' => 'general', 'help' => 'Vide : valeur de APP_NAME.'],
        'platform.description' => ['default' => null, 'rules' => ['nullable', 'string', 'max:300'], 'label' => 'Description', 'group' => 'general'],
        'platform.logo_url' => ['default' => null, 'rules' => ['nullable', 'string', 'max:500', 'regex:#^(/(?!/)|https?://)[^\s"\'<>]+$#'], 'label' => 'Logo', 'group' => 'general'],
        'platform.locale' => ['default' => 'fr', 'rules' => ['required', 'in:fr'], 'label' => 'Langue par défaut', 'group' => 'general', 'help' => 'Seul le français est disponible dans cette version.'],
        'brand.story' => ['default' => null, 'rules' => ['nullable', 'string', 'max:3000'], 'label' => 'Notre histoire (texte de la page « Notre histoire »)', 'group' => 'brand', 'input' => 'textarea', 'help' => 'Origine du projet, signification du nom. Vide : la section n’est pas affichée.'],
        'brand.aboro_meaning' => ['default' => 'Abòrò, c’est l’amitié, la convivialité et le plaisir d’apprendre ensemble. C’est ainsi que nous voulons apprendre les réseaux : entre amis, en explorant, en se trompant et en comprenant ensemble.', 'rules' => ['nullable', 'string', 'max:1000'], 'label' => 'Signification de « Abòrò »', 'group' => 'brand', 'input' => 'textarea', 'help' => 'Affichée sur la page « Notre histoire ».'],
        'platform.contact_email' => ['default' => null, 'rules' => ['nullable', 'email', 'max:190'], 'label' => 'Adresse de contact', 'group' => 'general'],
        'accounts.registration_open' => ['default' => true, 'rules' => ['boolean'], 'label' => 'Inscriptions ouvertes', 'group' => 'accounts'],
        'accounts.require_verification' => ['default' => true, 'rules' => ['boolean'], 'label' => "Vérification de l'e-mail obligatoire pour les TP", 'group' => 'accounts'],
        'labs.preview_steps' => ['default' => 3, 'rules' => ['integer', 'min:1', 'max:8'], 'label' => "Étapes visibles dans l'aperçu public d'un TP", 'group' => 'labs'],
        'analytics.presence_window' => ['default' => 5, 'rules' => ['integer', 'min:1', 'max:60'], 'label' => "Fenêtre d'activité (minutes)", 'group' => 'analytics', 'help' => 'Une session est « active » si elle a envoyé un signal pendant cette durée.'],
        'analytics.retention_days' => ['default' => 180, 'rules' => ['integer', 'min:30', 'max:395'], 'label' => 'Conservation des événements analytiques (jours)', 'group' => 'analytics', 'help' => 'Au-delà, les événements et sessions de mesure sont supprimés automatiquement.'],
        'assistant.enabled' => ['default' => true, 'rules' => ['boolean'], 'label' => 'Assistant pédagogique activé', 'group' => 'assistant'],
        'legal.terms_url' => ['default' => null, 'rules' => ['nullable', 'url', 'max:500'], 'label' => "Lien externe vers les conditions d'utilisation", 'group' => 'legal', 'help' => 'Vide : page intégrée /conditions.'],
        'legal.privacy_url' => ['default' => null, 'rules' => ['nullable', 'url', 'max:500'], 'label' => 'Lien externe vers la politique de confidentialité', 'group' => 'legal', 'help' => 'Vide : page intégrée /confidentialite.'],
    ];

    public const GROUPS = [
        'general' => 'Général',
        'brand' => 'Marque et communauté',
        'accounts' => 'Comptes',
        'labs' => 'Travaux pratiques',
        'analytics' => "Mesure d'audience",
        'assistant' => 'Assistant',
        'legal' => 'Mentions légales',
    ];

    /** @var array<string, mixed>|null */
    private ?array $cache = null;

    public function get(string $key): mixed
    {
        $values = $this->all();

        return array_key_exists($key, $values) ? $values[$key] : (self::DEFINITIONS[$key]['default'] ?? null);
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }
        $stored = Cache::remember('netlab.settings', 300, function () {
            if (! Schema::hasTable('settings')) {
                return [];
            }

            return Setting::query()->pluck('value', 'key')->all();
        });
        $values = [];
        foreach (self::DEFINITIONS as $key => $definition) {
            $values[$key] = array_key_exists($key, $stored) ? $stored[$key] : $definition['default'];
        }

        return $this->cache = $values;
    }

    /** @param array<string, mixed> $values */
    public function put(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! isset(self::DEFINITIONS[$key])) {
                continue;
            }
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
        $this->flush();
    }

    public function flush(): void
    {
        $this->cache = null;
        Cache::forget('netlab.settings');
    }

    public function platformName(): string
    {
        return $this->get('platform.name') ?: config('netlab.name');
    }
}
