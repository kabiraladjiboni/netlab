<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProtocolCategory extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['planned' => 'array'];
    }

    public function protocols(): HasMany
    {
        return $this->hasMany(Protocol::class)->orderBy('sort');
    }
}
