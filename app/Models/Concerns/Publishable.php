<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/** Contenu pouvant être en brouillon ou publié (colonne status_publication). */
trait Publishable
{
    public const PUBLICATION = ['draft' => 'Brouillon', 'published' => 'Publié'];

    public function scopePublished(Builder $query): Builder
    {
        return $query->where($this->getTable().'.status_publication', 'published');
    }

    public function isPublished(): bool
    {
        return $this->status_publication === 'published';
    }
}
