<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Scénario pédagogique : soit intégré au code (source = builtin, seule la
 * publication est gérée ici), soit créé depuis l'administration (source =
 * custom, définition JSON validée avant publication).
 */
class ScenarioDefinition extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['definition' => 'array', 'validated_at' => 'datetime'];
    }

    public function isPublished(): bool
    {
        return $this->status_publication === 'published';
    }
}
