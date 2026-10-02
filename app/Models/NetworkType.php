<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NetworkType extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['technologies' => 'array'];
    }
}
