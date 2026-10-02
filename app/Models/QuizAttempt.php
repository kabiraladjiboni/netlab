<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizAttempt extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return ['answers' => 'array', 'created_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function percent(): int
    {
        return $this->total > 0 ? (int) round($this->score / $this->total * 100) : 0;
    }
}
