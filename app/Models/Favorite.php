<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Favorite extends Model
{
    public const UPDATED_AT = null;

    /** Types de contenus que l'on peut mettre en favori. */
    public const TYPES = ['lesson' => 'Leçon', 'protocol' => 'Protocole', 'lab' => 'TP'];

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
