<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackReport extends Model
{
    public const CATEGORIES = [
        'explication' => 'Explication difficile à comprendre',
        'erreur' => 'Erreur technique dans le contenu',
        'animation' => 'Animation défectueuse',
        'quiz' => 'Question de quiz ambiguë',
        'accessibilite' => "Problème d'accessibilité",
        'technique' => 'Problème technique (bug, page)',
        'autre' => 'Autre',
    ];

    public const STATUSES = ['new' => 'Nouveau', 'in_progress' => 'En cours', 'resolved' => 'Résolu', 'closed' => 'Fermé'];

    public const PRIORITIES = ['low' => 'Basse', 'normal' => 'Normale', 'high' => 'Haute'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
