<?php

namespace App\Models;

use App\Models\Concerns\Publishable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TechnicalTerm extends Model
{
    use Publishable;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['aliases' => 'array'];
    }

    public function related(): BelongsToMany
    {
        return $this->belongsToMany(TechnicalTerm::class, 'technical_term_relations', 'technical_term_id', 'related_term_id');
    }

    public function protocols(): BelongsToMany
    {
        return $this->belongsToMany(Protocol::class);
    }

    /** @return array<string, mixed> */
    public function toDetail(): array
    {
        $this->loadMissing(['related', 'protocols']);

        return [
            'slug' => $this->slug,
            'term' => $this->term,
            'aliases' => $this->aliases,
            'category' => $this->category,
            'simple' => $this->simple,
            'technical' => $this->technical,
            'example' => $this->example,
            'related' => $this->related->map(fn (TechnicalTerm $term) => ['slug' => $term->slug, 'term' => $term->term])->values(),
            'protocols' => $this->protocols->map(fn (Protocol $protocol) => [
                'slug' => $protocol->slug, 'acronym' => $protocol->acronym, 'name' => $protocol->name,
            ])->values(),
        ];
    }
}
