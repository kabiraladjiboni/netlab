<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ContentRating;
use App\Models\Favorite;
use App\Models\User;

trait ProvidesEngagement
{
    /** État « favori » et évaluation de l'utilisateur pour un contenu. */
    protected function engagement(?User $user, string $type, string $slug): ?array
    {
        if ($user === null) {
            return null;
        }
        $rating = ContentRating::query()->where('user_id', $user->id)->where('subject_type', $type)->where('subject_slug', $slug)->first();

        return [
            'type' => $type,
            'slug' => $slug,
            'favorite' => Favorite::query()->where('user_id', $user->id)->where('subject_type', $type)->where('subject_slug', $slug)->exists(),
            'rating' => $rating ? ['value' => $rating->value, 'comment' => $rating->comment] : null,
        ];
    }

    /** Un brouillon n'est visible que par un administrateur (aperçu). */
    protected function ensureVisible(?User $user, bool $published): void
    {
        abort_unless($published || $user?->isAdmin(), 404);
    }
}
