<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonVisit extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['first_visited_at' => 'datetime', 'last_visited_at' => 'datetime'];
    }
}
