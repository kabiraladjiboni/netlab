<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Equipment extends Model
{
    protected $table = 'equipment';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['confusions' => 'array', 'layers' => 'array'];
    }

    public function protocols(): BelongsToMany
    {
        return $this->belongsToMany(Protocol::class);
    }
}
