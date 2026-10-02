<?php

namespace App\Services\Learning;

use App\Models\LabSession;
use App\Models\LessonVisit;
use App\Models\User;

/**
 * Règles de progression des TP.
 *  - Une séance démarrée n'est jamais comptée comme terminée.
 *  - Scénario : terminé quand TOUTES les étapes ont été vues.
 *  - Diagnostic : terminé quand la bonne cause a été trouvée.
 *  - Le temps actif est plafonné par mise à jour pour ignorer les onglets oubliés.
 */
class ProgressService
{
    public const MAX_ACTIVE_DELTA = 120;

    public function startOrResume(User $user, string $type, string $slug, ?string $variant, int $totalSteps): LabSession
    {
        $session = $user->labSessions()
            ->where('lab_type', $type)->where('lab_slug', $slug)->where('variant', $variant)
            ->where('status', 'in_progress')->latest('last_activity_at')->first();

        if ($session !== null) {
            if ($totalSteps > 0 && $session->total_steps !== $totalSteps) {
                // Le scénario a changé depuis : on garde la progression compatible.
                $session->total_steps = $totalSteps;
                $session->steps_seen = array_values(array_filter($session->steps_seen ?? [], fn ($step) => $step < $totalSteps));
                $session->current_step = min($session->current_step, max(0, $totalSteps - 1));
            }
            $session->last_activity_at = now();
            $session->save();

            return $session;
        }

        // Un TP déjà terminé est rouvert tel quel (rejouer ne crée pas une nouvelle séance).
        $completed = $user->labSessions()
            ->where('lab_type', $type)->where('lab_slug', $slug)->where('variant', $variant)
            ->where('status', 'completed')->latest('completed_at')->first();
        if ($completed !== null) {
            $completed->forceFill(['last_activity_at' => now()])->save();

            return $completed;
        }

        $session = new LabSession([
            'lab_type' => $type,
            'lab_slug' => $slug,
            'variant' => $variant,
            'status' => 'in_progress',
            'current_step' => 0,
            'total_steps' => $totalSteps,
            'steps_seen' => $type === LabSession::TYPE_SCENARIO ? [0] : [],
            'started_at' => now(),
            'last_activity_at' => now(),
        ]);
        $session->user()->associate($user);
        $session->save();

        return $session;
    }

    /**
     * @param  list<int>  $stepsSeen
     * @return bool true si la séance vient d'être terminée
     */
    public function recordSteps(LabSession $session, int $currentStep, array $stepsSeen, int $activeDelta): bool
    {
        $total = max(0, $session->total_steps);
        $valid = array_filter($stepsSeen, fn ($step) => is_int($step) && $step >= 0 && $step < $total);
        $merged = array_values(array_unique([...($session->steps_seen ?? []), ...$valid]));
        sort($merged);

        $session->steps_seen = $merged;
        $session->current_step = max(0, min($currentStep, max(0, $total - 1)));
        $session->active_seconds += max(0, min($activeDelta, self::MAX_ACTIVE_DELTA));
        $session->last_activity_at = now();

        $justCompleted = false;
        if (! $session->isCompleted() && $total > 0 && count($merged) >= $total) {
            $session->status = 'completed';
            $session->completed_at = now();
            $justCompleted = true;
        }
        $session->save();

        return $justCompleted;
    }

    public function visitLesson(User $user, string $slug): void
    {
        $visit = LessonVisit::query()->firstOrNew(['user_id' => $user->id, 'lesson_slug' => $slug]);
        if (! $visit->exists) {
            $visit->first_visited_at = now();
            $visit->visits = 0;
        }
        $visit->visits++;
        $visit->last_visited_at = now();
        $visit->save();
    }
}
