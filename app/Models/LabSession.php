<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une séance de travaux pratiques (scénario animé ou exercice de diagnostic).
 * Un TP est « terminé » uniquement lorsque toutes ses étapes ont été vues
 * (scénario) ou que le problème a été résolu (diagnostic).
 */
class LabSession extends Model
{
    public const TYPE_SCENARIO = 'scenario';

    public const TYPE_DIAGNOSTIC = 'diagnostic';

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return [
            'steps_seen' => 'array',
            'started_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function progressPercent(): int
    {
        if ($this->isCompleted()) {
            return 100;
        }
        if ($this->lab_type === self::TYPE_DIAGNOSTIC || $this->total_steps === 0) {
            return 0;
        }

        return (int) round(count($this->steps_seen ?? []) / $this->total_steps * 100);
    }

    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'lab_type' => $this->lab_type,
            'lab_slug' => $this->lab_slug,
            'variant' => $this->variant,
            'status' => $this->status,
            'current_step' => $this->current_step,
            'total_steps' => $this->total_steps,
            'steps_seen' => $this->steps_seen ?? [],
            'progress' => $this->progressPercent(),
            'attempts' => $this->attempts,
            'hints_used' => $this->hints_used,
            'active_seconds' => $this->active_seconds,
            'started_at' => $this->started_at?->toIso8601String(),
            'last_activity_at' => $this->last_activity_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
        ];
    }
}
