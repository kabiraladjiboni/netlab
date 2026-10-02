<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class NetworkLayer extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['examples' => 'array', 'devices' => 'array', 'maps_to' => 'array'];
    }

    public function protocols(): BelongsToMany
    {
        return $this->belongsToMany(Protocol::class)->orderBy('sort');
    }
}
