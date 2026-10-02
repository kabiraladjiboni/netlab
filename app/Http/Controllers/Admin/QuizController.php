<?php

namespace App\Http\Controllers\Admin;

use App\Models\Lesson;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class QuizController extends AdminController
{
    public const TYPES = ['single' => 'Choix unique', 'multiple' => 'Choix multiples', 'order' => 'Remise en ordre', 'match' => 'Association'];

    public function index(): Response
    {
        $attempts = QuizAttempt::selectRaw('quiz_slug, COUNT(*) as n, AVG(score * 100.0 / CASE WHEN total = 0 THEN 1 ELSE total END) as avg')->groupBy('quiz_slug')->get()->keyBy('quiz_slug');

        return Inertia::render('admin/quizzes/index', [
            'quizzes' => Quiz::withCount('questions')->orderBy('module')->orderBy('title')->get()->map(fn (Quiz $q) => [
                'id' => $q->id, 'slug' => $q->slug, 'title' => $q->title, 'module' => $q->module, 'questions' => $q->questions_count,
                'status' => $q->status_publication, 'attempts' => (int) ($attempts[$q->slug]->n ?? 0),
                'average' => isset($attempts[$q->slug]) ? (int) round($attempts[$q->slug]->avg) : null,
            ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/quizzes/edit', ['quiz' => null, 'types' => self::TYPES]);
    }

    public function edit(Quiz $quiz): Response
    {
        return Inertia::render('admin/quizzes/edit', [
            'quiz' => [
                ...$quiz->only(['id', 'slug', 'title', 'description', 'module', 'status_publication']),
                'questions' => $quiz->questions->map(fn ($q) => ['type' => $q->type, 'prompt' => $q->prompt, 'context' => $q->context, 'explanation' => $q->explanation, ...$q->payload])->values(),
                'attempts' => QuizAttempt::where('quiz_slug', $quiz->slug)->count(),
            ],
            'types' => self::TYPES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $quiz = new Quiz;
        $this->save($request, $quiz);
        $this->log($request, 'quiz.created', 'quiz', $quiz->title);

        return redirect()->route('admin.quizzes.edit', $quiz)->with('success', 'Quiz créé.');
    }

    public function update(Request $request, Quiz $quiz): RedirectResponse
    {
        $this->save($request, $quiz);
        $this->log($request, 'quiz.updated', 'quiz', $quiz->title, ['statut' => $quiz->status_publication]);

        return back()->with('success', 'Quiz enregistré.');
    }

    public function destroy(Request $request, Quiz $quiz): RedirectResponse
    {
        if (QuizAttempt::where('quiz_slug', $quiz->slug)->exists() || Lesson::where('quiz_id', $quiz->id)->exists()) {
            return back()->with('error', 'Ce quiz a déjà des résultats ou est rattaché à un chapitre : dépublie-le plutôt.');
        }
        $quiz->delete();
        $this->log($request, 'quiz.deleted', 'quiz', $quiz->title);

        return redirect()->route('admin.quizzes.index')->with('success', 'Quiz supprimé.');
    }

    private function save(Request $request, Quiz $quiz): void
    {
        $data = $request->validate([
            'slug' => [...$this->slugRule(), Rule::unique('quizzes', 'slug')->ignore($quiz->id)],
            'title' => ['required', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:1000'],
            'module' => ['nullable', 'string', 'max:40'],
            'status_publication' => ['required', Rule::in(['draft', 'published'])],
            'questions' => ['required', 'array', 'min:1', 'max:40'],
            'questions.*.type' => ['required', Rule::in(array_keys(self::TYPES))],
            'questions.*.prompt' => ['required', 'string', 'max:1000'],
            'questions.*.context' => ['nullable', 'string', 'max:2000'],
            'questions.*.explanation' => ['required', 'string', 'max:2000'],
            'questions.*.options' => ['array', 'max:8'], 'questions.*.options.*' => ['string', 'max:300'],
            'questions.*.items' => ['array', 'max:10'], 'questions.*.items.*' => ['string', 'max:300'],
            'questions.*.pairs' => ['array', 'max:8'],
            'questions.*.pairs.*.left' => ['required', 'string', 'max:200'],
            'questions.*.pairs.*.right' => ['required', 'string', 'max:200'],
        ], ['questions.*.explanation.required' => 'Chaque question doit avoir une correction détaillée.']);

        $errors = [];
        $questions = [];
        foreach ($data['questions'] as $i => $question) {
            $n = $i + 1;
            $payload = [];
            switch ($question['type']) {
                case 'single':
                case 'multiple':
                    $options = array_values(array_filter(array_map('trim', $question['options'] ?? []), fn ($o) => $o !== ''));
                    $answer = $request->input("questions.{$i}.answer");
                    if (count($options) < 2) {
                        $errors["questions.{$i}.options"] = "Question {$n} : au moins deux choix.";
                    }
                    if ($question['type'] === 'single') {
                        if (! is_numeric($answer) || (int) $answer < 0 || (int) $answer >= count($options)) {
                            $errors["questions.{$i}.answer"] = "Question {$n} : indique la bonne réponse.";
                        }
                        $payload = ['options' => $options, 'answer' => (int) $answer];
                    } else {
                        $answers = array_values(array_unique(array_map('intval', (array) $answer)));
                        if ($answers === [] || max($answers) >= count($options) || min($answers) < 0) {
                            $errors["questions.{$i}.answer"] = "Question {$n} : coche au moins une bonne réponse.";
                        }
                        sort($answers);
                        $payload = ['options' => $options, 'answer' => $answers];
                    }
                    break;
                case 'order':
                    $items = array_values(array_filter(array_map('trim', $question['items'] ?? []), fn ($o) => $o !== ''));
                    if (count($items) < 3) {
                        $errors["questions.{$i}.items"] = "Question {$n} : au moins trois éléments, dans le bon ordre.";
                    }
                    $payload = ['items' => $items];
                    break;
                case 'match':
                    $pairs = array_values($question['pairs'] ?? []);
                    if (count($pairs) < 2) {
                        $errors["questions.{$i}.pairs"] = "Question {$n} : au moins deux paires.";
                    }
                    $payload = ['pairs' => $pairs];
                    break;
            }
            $questions[] = ['type' => $question['type'], 'prompt' => $question['prompt'], 'context' => $question['context'] ?? null, 'explanation' => $question['explanation'], 'payload' => $payload];
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        DB::transaction(function () use ($quiz, $data, $questions) {
            $quiz->fill([...collect($data)->only(['slug', 'title', 'description', 'module', 'status_publication'])->all(), 'content_updated_at' => now()])->save();
            $quiz->questions()->delete();
            foreach ($questions as $index => $question) {
                $quiz->questions()->create([...$question, 'sort' => $index]);
            }
        });
    }
}
