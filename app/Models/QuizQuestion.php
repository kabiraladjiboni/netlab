<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizQuestion extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    /** @return array<string, mixed> */
    public function toPayload(): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'prompt' => $this->prompt,
            'context' => $this->context,
            'explanation' => $this->explanation,
            ...$this->payload,
        ];
    }
}
