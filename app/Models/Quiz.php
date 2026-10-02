<?php

namespace App\Models;

use App\Models\Concerns\Publishable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quiz extends Model
{
    use Publishable;

    protected $guarded = [];

    public function questions(): HasMany
    {
        return $this->hasMany(QuizQuestion::class)->orderBy('sort');
    }

    /** @return array<string, mixed> */
    public function toPayload(): array
    {
        $this->loadMissing('questions');

        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'description' => $this->description,
            'questions' => $this->questions->map(fn (QuizQuestion $question) => $question->toPayload())->values(),
        ];
    }
}
