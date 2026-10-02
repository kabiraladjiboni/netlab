<?php

namespace App\Services\Learning;

use App\Models\Quiz;
use App\Models\QuizQuestion;

/** Correction côté serveur (même logique que le composant QuizRunner). */
class QuizGrader
{
    /**
     * @param  array<int|string, mixed>  $answers  réponses indexées par identifiant de question
     * @return array{score: int, total: int}
     */
    public function grade(Quiz $quiz, array $answers): array
    {
        $quiz->loadMissing('questions');
        $score = 0;
        foreach ($quiz->questions as $question) {
            if ($this->isCorrect($question, $answers[(string) $question->id] ?? null)) {
                $score++;
            }
        }

        return ['score' => $score, 'total' => $quiz->questions->count()];
    }

    public function isCorrect(QuizQuestion $question, mixed $answer): bool
    {
        $payload = $question->payload;

        return match ($question->type) {
            'single' => is_int($answer) && $answer === $payload['answer'],
            'multiple' => is_array($answer) && $this->sameSet($answer, $payload['answer']),
            'order' => is_array($answer) && array_values($answer) === array_values($payload['items']),
            'match' => is_array($answer) && collect($payload['pairs'])->every(fn ($pair) => ($answer[$pair['left']] ?? null) === $pair['right']),
            default => false,
        };
    }

    private function sameSet(array $given, array $expected): bool
    {
        $given = array_map('intval', $given);
        sort($given);
        sort($expected);

        return $given === $expected;
    }
}
