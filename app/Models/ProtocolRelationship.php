<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProtocolRelationship extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /** Libellés lisibles des types de relation. */
    public const TYPES = [
        'uses' => 's’appuie sur',
        'used-by' => 'utilisé par',
        'secures' => 'sécurise',
        'secured-by' => 'sécurisé par',
        'alternative' => 'alternative',
        'evolution' => 'évolution / successeur',
        'predecessor' => 'prédécesseur',
        'complement' => 'complémentaire',
        'related' => 'lié',
    ];

    /** Type inverse utilisé pour créer automatiquement la relation réciproque. */
    public const INVERSE = [
        'uses' => 'used-by',
        'used-by' => 'uses',
        'secures' => 'secured-by',
        'secured-by' => 'secures',
        'alternative' => 'alternative',
        'evolution' => 'predecessor',
        'predecessor' => 'evolution',
        'complement' => 'complement',
        'related' => 'related',
    ];

    public function protocol(): BelongsTo
    {
        return $this->belongsTo(Protocol::class);
    }

    public function related(): BelongsTo
    {
        return $this->belongsTo(Protocol::class, 'related_protocol_id');
    }
}
