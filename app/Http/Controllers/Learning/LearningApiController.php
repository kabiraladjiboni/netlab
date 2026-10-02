<?php

namespace App\Http\Controllers\Learning;

use App\Http\Controllers\Controller;
use App\Models\ContentRating;
use App\Models\Diagnostic;
use App\Models\Favorite;
use App\Models\FeedbackReport;
use App\Models\LabSession;
use App\Models\Lesson;
use App\Models\Quiz;
use App\Services\Analytics\Tracker;
use App\Services\Learning\ContentResolver;
use App\Services\Learning\ProgressService;
use App\Services\Learning\QuizGrader;
use App\Services\Learning\ScenarioCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * API de progression (session Web + CSRF). Toutes les opérations portent sur
 * l'utilisateur connecté : un identifiant d'une autre personne renvoie 404.
 */
class LearningApiController extends Controller
{
    public function __construct(
        private readonly ProgressService $progress,
        private readonly Tracker $tracker,
    ) {}

    public function startLab(Request $request, string $slug, ScenarioCatalog $scenarios): JsonResponse
    {
        $data = $request->validate([
            'variant' => ['nullable', 'string', 'max:60', 'regex:/^[a-z0-9-]+$/'],
            'total_steps' => ['required', 'integer', 'min:1', 'max:200'],
        ]);
        $lesson = Lesson::query()->where('slug', $slug)->where('kind', 'scenario')->whereNotNull('scenario_key')->firstOrFail();
        abort_unless(($lesson->isPublished() && $scenarios->isPublished($lesson->scenario_key)) || $request->user()->isAdmin(), 404);

        $existing = $request->user()->labSessions()->where('lab_type', 'scenario')->where('lab_slug', $slug)
            ->where('variant', $data['variant'] ?? null)->exists();
        $session = $this->progress->startOrResume($request->user(), LabSession::TYPE_SCENARIO, $slug, $data['variant'] ?? null, $data['total_steps']);
        if (! $existing) {
            $this->tracker->record($request, 'lab_start', 'lab', $slug, meta: ['variant' => $data['variant'] ?? null]);
        }

        return response()->json(['session' => $session->toPublicArray()]);
    }

    public function updateLab(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'current_step' => ['required', 'integer', 'min:0', 'max:500'],
            'steps_seen' => ['present', 'array', 'max:500'],
            'steps_seen.*' => ['integer', 'min:0', 'max:500'],
            'active_delta' => ['nullable', 'integer', 'min:0', 'max:3600'],
        ]);
        /** @var LabSession $session */
        $session = $request->user()->labSessions()->where('lab_type', 'scenario')->findOrFail($id);

        $completed = $this->progress->recordSteps($session, $data['current_step'], $data['steps_seen'], $data['active_delta'] ?? 0);
        if ($completed) {
            $this->tracker->record($request, 'lab_complete', 'lab', $session->lab_slug, $session->active_seconds, ['variant' => $session->variant]);
        }

        return response()->json(['session' => $session->toPublicArray(), 'just_completed' => $completed]);
    }

    public function diagnosticHint(Request $request, string $slug): JsonResponse
    {
        $diagnostic = Diagnostic::query()->published()->where('slug', $slug)->firstOrFail();
        $session = $this->progress->startOrResume($request->user(), LabSession::TYPE_DIAGNOSTIC, $slug, null, 0);
        $hints = $diagnostic->hints;
        if ($session->hints_used < count($hints)) {
            $session->hints_used++;
            $session->last_activity_at = now();
            $session->save();
        }

        return response()->json(['hints' => array_slice($hints, 0, $session->hints_used), 'remaining' => count($hints) - $session->hints_used]);
    }

    public function diagnosticAnswer(Request $request, string $slug): JsonResponse
    {
        $diagnostic = Diagnostic::query()->published()->where('slug', $slug)->firstOrFail();
        $data = $request->validate(['choice' => ['required', 'integer', 'min:0', 'max:'.(count($diagnostic->choices) - 1)]]);

        $session = $this->progress->startOrResume($request->user(), LabSession::TYPE_DIAGNOSTIC, $slug, null, 0);
        $correct = $data['choice'] === $diagnostic->answer;
        if (! $session->isCompleted()) {
            $session->attempts++;
            if ($correct) {
                $session->status = 'completed';
                $session->completed_at = now();
            }
            $session->last_activity_at = now();
            $session->save();
            $this->tracker->record($request, $correct ? 'diagnostic_solved' : 'diagnostic_attempt', 'diagnostic', $slug, $session->attempts);
        }

        $reveal = $correct || $session->attempts >= 2;

        return response()->json([
            'correct' => $correct,
            'attempts' => $session->attempts,
            'answer' => $reveal ? $diagnostic->answer : null,
            'explanation' => $reveal ? $diagnostic->explanation : null,
            'related' => $reveal ? $diagnostic->related : [],
        ]);
    }

    public function quizAttempt(Request $request, QuizGrader $grader): JsonResponse
    {
        $data = $request->validate([
            'quiz' => ['required', 'string', 'max:120'],
            'answers' => ['present', 'array', 'max:50'],
            'duration' => ['nullable', 'integer', 'min:0', 'max:86400'],
        ]);
        $quiz = Quiz::query()->published()->where('slug', $data['quiz'])->first();
        $generated = null;
        if ($quiz === null && str_starts_with($data['quiz'], 'protocole-')) {
            // Quiz généré automatiquement à partir d'une fiche protocole.
            $protocol = \App\Models\Protocol::query()->published()->where('slug', substr($data['quiz'], 10))->firstOrFail();
            $generated = app(\App\Services\Content\QuizGenerator::class)->forProtocol($protocol);
        }
        abort_if($quiz === null && $generated === null, 404);

        if ($quiz !== null) {
            ['score' => $score, 'total' => $total] = $grader->grade($quiz, $data['answers']);
        } else {
            [$score, $total] = $this->gradeGenerated($generated, $data['answers']);
        }

        $attempt = $request->user()->quizAttempts()->create([
            'quiz_slug' => $data['quiz'],
            'score' => $score,
            'total' => $total,
            'answers' => $data['answers'],
            'duration_seconds' => $data['duration'] ?? null,
            'created_at' => now(),
        ]);
        $this->tracker->record($request, 'quiz_submit', 'quiz', $data['quiz'], $attempt->percent());

        return response()->json(['attempt' => ['id' => $attempt->id, 'score' => $score, 'total' => $total, 'percent' => $attempt->percent()]]);
    }

    /** @return array{0: int, 1: int} */
    private function gradeGenerated(?array $quiz, array $answers): array
    {
        $score = 0;
        foreach ($quiz['questions'] ?? [] as $question) {
            $model = new \App\Models\QuizQuestion(['type' => $question['type'], 'payload' => collect($question)->only(['options', 'answer', 'items', 'pairs'])->all()]);
            if (app(QuizGrader::class)->isCorrect($model, $answers[$question['id']] ?? null)) {
                $score++;
            }
        }

        return [$score, count($quiz['questions'] ?? [])];
    }

    public function toggleFavorite(Request $request, ContentResolver $resolver): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Favorite::TYPES))],
            'slug' => ['required', 'string', 'max:190'],
        ]);
        abort_unless($resolver->exists($data['type'], $data['slug']), 404);

        $existing = $request->user()->favorites()->where('subject_type', $data['type'])->where('subject_slug', $data['slug'])->first();
        if ($existing) {
            $existing->delete();
            $this->tracker->record($request, 'favorite_remove', $data['type'], $data['slug']);

            return response()->json(['favorite' => false]);
        }
        $request->user()->favorites()->create(['subject_type' => $data['type'], 'subject_slug' => $data['slug'], 'created_at' => now()]);
        $this->tracker->record($request, 'favorite_add', $data['type'], $data['slug']);

        return response()->json(['favorite' => true]);
    }

    public function rate(Request $request, ContentResolver $resolver): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(ContentRating::TYPES))],
            'slug' => ['required', 'string', 'max:190'],
            'value' => ['required', Rule::in(array_keys(ContentRating::VALUES))],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        abort_unless($resolver->exists($data['type'], $data['slug']), 404);

        $comment = isset($data['comment']) ? trim($data['comment']) : null;
        $rating = ContentRating::query()->firstOrNew([
            'user_id' => $request->user()->id,
            'subject_type' => $data['type'],
            'subject_slug' => $data['slug'],
        ]);
        $isNew = ! $rating->exists;
        $commentChanged = $comment !== $rating->comment;
        $rating->user_id = $request->user()->id;
        $rating->value = $data['value'];
        $rating->comment = $comment ?: null;
        if ($commentChanged) {
            // Un commentaire n'est jamais publié automatiquement : il attend une modération.
            $rating->comment_status = $rating->comment ? 'pending' : null;
        }
        $rating->save();
        if ($isNew) {
            $this->tracker->record($request, 'rating', $data['type'], $data['slug'], $data['value'] === 'useful' ? 1 : 0);
        }

        return response()->json(['rating' => ['value' => $rating->value, 'comment' => $rating->comment]]);
    }

    public function feedback(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(FeedbackReport::CATEGORIES))],
            'subject_type' => ['nullable', Rule::in(ContentResolver::TYPES)],
            'subject_slug' => ['nullable', 'string', 'max:190'],
            'page_url' => ['nullable', 'string', 'max:500'],
            'message' => ['required', 'string', 'min:5', 'max:2000'],
        ]);
        $page = $data['page_url'] ?? null;
        if ($page !== null && ! \App\Http\Controllers\Auth\Intended::isSafe($page)) {
            $page = null;
        }

        FeedbackReport::create([
            'user_id' => $request->user()->id,
            'category' => $data['category'],
            'subject_type' => $data['subject_type'] ?? null,
            'subject_slug' => $data['subject_slug'] ?? null,
            'page_url' => $page,
            'message' => trim($data['message']),
            'status' => 'new',
            'priority' => 'normal',
        ]);

        return response()->json(['ok' => true], 201);
    }

    public function presence(Request $request): Response
    {
        $this->tracker->touch($request);

        return response()->noContent();
    }

    public function consent(Request $request): JsonResponse
    {
        $data = $request->validate(['choice' => ['required', Rule::in(['granted', 'denied'])]]);

        // Choix conservé 6 mois, puis redemandé.
        return response()->json(['consent' => $data['choice']])
            ->cookie(Tracker::CONSENT_COOKIE, $data['choice'], 60 * 24 * 182, '/', null, null, true, false, 'lax');
    }
}
