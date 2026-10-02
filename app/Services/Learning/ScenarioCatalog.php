<?php

namespace App\Services\Learning;

use App\Models\ScenarioDefinition;
use Illuminate\Support\Facades\Schema;

/**
 * Registre des scénarios disponibles : scénarios intégrés (code TypeScript)
 * et scénarios personnalisés (JSON validé, créés dans l'administration).
 */
class ScenarioCatalog
{
    /** Garantit qu'une ligne existe pour chaque scénario intégré. */
    public function syncBuiltins(): void
    {
        if (! Schema::hasTable('scenario_definitions')) {
            return;
        }
        foreach (config('netlab.builtin_scenarios') as $key => $title) {
            ScenarioDefinition::query()->firstOrCreate(
                ['key' => $key],
                ['title' => $title, 'source' => 'builtin', 'status_publication' => 'published', 'validated_at' => now()],
            );
        }
    }

    public function isPublished(string $key): bool
    {
        $definition = ScenarioDefinition::query()->where('key', $key)->first();
        if ($definition === null) {
            return array_key_exists($key, config('netlab.builtin_scenarios'));
        }

        return $definition->isPublished();
    }

    /** Définition JSON d'un scénario personnalisé (null pour un scénario intégré). */
    public function customDefinition(string $key, bool $includeDrafts = false): ?array
    {
        $definition = ScenarioDefinition::query()->where('key', $key)->where('source', 'custom')->first();
        if ($definition === null || (! $includeDrafts && ! $definition->isPublished())) {
            return null;
        }

        return self::forClient($definition->definition);
    }

    /** JSON → PHP perd la différence {} / [] : on restaure les objets attendus par le moteur. */
    public static function forClient(?array $definition): ?array
    {
        if ($definition === null) {
            return null;
        }
        $definition['packets'] = (object) ($definition['packets'] ?? []);

        return $definition;
    }

    /** @return array<string, string> clé => titre */
    public function options(): array
    {
        $this->syncBuiltins();

        return ScenarioDefinition::query()->orderBy('source')->orderBy('title')->pluck('title', 'key')->all();
    }
}
