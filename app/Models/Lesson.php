<?php

namespace App\Models;

use App\Models\Concerns\Publishable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Lesson extends Model
{
    use Publishable;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['featured' => 'boolean', 'concepts' => 'array', 'references' => 'array'];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function protocols(): BelongsToMany
    {
        return $this->belongsToMany(Protocol::class);
    }

    /** Une leçon « scenario » donne accès à un TP interactif. */
    public function isLab(): bool
    {
        return $this->kind === 'scenario' && $this->scenario_key !== null;
    }

    /** @return array<string, mixed> */
    public function toSummary(): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'track' => $this->track,
            'objective' => $this->objective,
            'duration' => $this->duration,
            'kind' => $this->kind,
            'href' => $this->href,
            'featured' => $this->featured,
            'scenario_key' => $this->scenario_key,
            'is_lab' => $this->isLab(),
        ];
    }
}
