<?php

namespace App\Models;

use App\Models\Concerns\Publishable;
use Illuminate\Database\Eloquent\Model;

class Diagnostic extends Model
{
    use Publishable;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'symptoms' => 'array',
            'observations' => 'array',
            'hints' => 'array',
            'choices' => 'array',
            'related' => 'array',
        ];
    }
}
