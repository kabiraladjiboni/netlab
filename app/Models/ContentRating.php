<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une évaluation par utilisateur et par contenu (contrainte d'unicité en base) :
 * cliquer plusieurs fois modifie l'évaluation existante au lieu d'en créer une nouvelle.
 */
class ContentRating extends Model
{
    public const VALUES = ['useful' => 'Utile', 'unclear' => 'Pas encore clair'];

    public const TYPES = ['lesson' => 'Leçon', 'protocol' => 'Protocole', 'lab' => 'TP'];

    protected $guarded = ['id', 'user_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
