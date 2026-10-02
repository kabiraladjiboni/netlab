<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Un cours regroupe des leçons (ses chapitres), dans un ordre défini. */
class Course extends Model
{
    public const LEVELS = ['debutant' => 'Débutant', 'intermediaire' => 'Intermédiaire', 'avance' => 'Avancé'];

    protected $guarded = ['id'];

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class)->orderBy('sort');
    }

    public function scopePublished($query)
    {
        return $query->where('status_publication', 'published');
    }
}
