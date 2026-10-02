<?php

namespace App\Http\Controllers\Admin;

use App\Models\Course;
use App\Models\LabSession;
use App\Models\Lesson;
use App\Models\LessonVisit;
use App\Models\Protocol;
use App\Models\Quiz;
use App\Models\TechnicalTerm;
use App\Services\Learning\ScenarioCatalog;
use App\Support\Text;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Chapitres (leçons) : textes, scénario animé, quiz, protocoles associés, références. */
class LessonController extends AdminController
{
    public function create(Request $request, ScenarioCatalog $scenarios): Response
    {
        return Inertia::render('admin/lessons/edit', [
            'lesson' => null,
            'options' => $this->options($scenarios),
            'defaultCourse' => $request->integer('cours') ?: null,
            'locked' => false,
        ]);
    }

    public function edit(Lesson $lesson, ScenarioCatalog $scenarios): Response
    {
        $lesson->load('protocols:id');

        return Inertia::render('admin/lessons/edit', [
            'lesson' => [
                'id' => $lesson->id, 'slug' => $lesson->slug, 'title' => $lesson->title, 'course_id' => $lesson->course_id,
                'objective' => $lesson->objective, 'duration' => $lesson->duration, 'kind' => $lesson->kind,
                'scenario_key' => $lesson->scenario_key, 'href' => $lesson->href, 'featured' => $lesson->featured,
                'concepts' => $lesson->concepts ?? [], 'quiz_id' => $lesson->quiz_id, 'intro' => $lesson->intro,
                'references' => collect($lesson->references ?? [])->map(fn ($r) => trim(($r['label'] ?? '').(isset($r['url']) ? ' | '.$r['url'] : '')))->implode("\n"),
                'protocols' => $lesson->protocols->pluck('id'), 'status_publication' => $lesson->status_publication,
                'updated_at' => $lesson->content_updated_at?->toIso8601String() ?? $lesson->updated_at?->toIso8601String(),
            ],
            'options' => $this->options($scenarios),
            'locked' => $this->hasLearnerData($lesson),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $lesson = new Lesson;
        $this->save($request, $lesson);
        $this->log($request, 'lesson.created', 'lesson', $lesson->title, ['statut' => $lesson->status_publication]);

        return redirect()->route('admin.lessons.edit', $lesson)->with('success', 'Chapitre créé.');
    }

    public function update(Request $request, Lesson $lesson): RedirectResponse
    {
        $before = $lesson->status_publication;
        $this->save($request, $lesson);
        $action = $before !== $lesson->status_publication ? ($lesson->status_publication === 'published' ? 'lesson.published' : 'lesson.unpublished') : 'lesson.updated';
        $this->log($request, $action, 'lesson', $lesson->title);

        return back()->with('success', $lesson->status_publication === 'published' ? 'Chapitre enregistré et publié.' : 'Brouillon enregistré.');
    }

    public function destroy(Request $request, Lesson $lesson): RedirectResponse
    {
        if ($this->hasLearnerData($lesson)) {
            return back()->with('error', 'Des étudiants ont déjà travaillé sur ce chapitre : dépublie-le plutôt que de le supprimer, pour conserver leur historique.');
        }
        $lesson->delete();
        $this->log($request, 'lesson.deleted', 'lesson', $lesson->title);

        return redirect()->route('admin.courses.index')->with('success', 'Chapitre supprimé.');
    }

    private function save(Request $request, Lesson $lesson): void
    {
        $locked = $lesson->exists && $this->hasLearnerData($lesson);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'slug' => [...$this->slugRule(), Rule::unique('lessons', 'slug')->ignore($lesson->id)],
            'course_id' => ['nullable', Rule::exists('courses', 'id')],
            'objective' => ['required', 'string', 'max:1000'],
            'duration' => ['required', 'integer', 'min:1', 'max:600'],
            'kind' => ['required', Rule::in(['scenario', 'page'])],
            'scenario_key' => ['nullable', 'required_if:kind,scenario', Rule::exists('scenario_definitions', 'key')],
            'href' => ['nullable', 'required_if:kind,page', 'string', 'max:190', 'regex:/^\/[a-z0-9\/\-]*$/'],
            'featured' => ['boolean'],
            'concepts' => ['array'],
            'concepts.*' => [Rule::exists('technical_terms', 'slug')],
            'quiz_id' => ['nullable', Rule::exists('quizzes', 'id')],
            'intro' => ['nullable', 'string', 'max:5000'],
            'references' => ['nullable', 'string', 'max:3000'],
            'protocols' => ['array'],
            'protocols.*' => ['integer', Rule::exists('protocols', 'id')],
            'status_publication' => ['required', Rule::in(['draft', 'published'])],
        ], ['scenario_key.required_if' => 'Choisis le scénario animé de ce TP.', 'href.required_if' => 'Indique l’adresse de la page (ex. /modeles/osi).']);

        if ($locked && $data['slug'] !== $lesson->slug) {
            $data['slug'] = $lesson->slug;
        }

        $references = collect($this->lines($data['references'] ?? ''))->map(function (string $line) {
            [$label, $url] = array_pad(array_map('trim', explode('|', $line, 2)), 2, null);

            return ['label' => $label, 'url' => $url && filter_var($url, FILTER_VALIDATE_URL) ? $url : null];
        })->all();

        $lesson->fill([
            'title' => $data['title'],
            'slug' => $data['slug'],
            'course_id' => $data['course_id'] ?? null,
            'track' => $data['course_id'] ? Course::find($data['course_id'])->title : 'Hors cours',
            'objective' => $data['objective'],
            'duration' => $data['duration'],
            'kind' => $data['kind'],
            'scenario_key' => $data['kind'] === 'scenario' ? $data['scenario_key'] : null,
            'href' => $data['kind'] === 'scenario' ? '/lecons/'.$data['slug'] : $data['href'],
            'featured' => $data['featured'] ?? false,
            'concepts' => array_values(array_unique($data['concepts'] ?? [])),
            'quiz_id' => $data['quiz_id'] ?? null,
            'intro' => $data['intro'] ?? null,
            'references' => $references,
            'status_publication' => $data['status_publication'],
            'content_updated_at' => now(),
            'search_text' => Text::searchable($data['title'], $data['objective'], implode(' ', $data['concepts'] ?? [])),
        ]);
        if (! $lesson->exists) {
            $lesson->sort = (Lesson::where('course_id', $lesson->course_id)->max('sort') ?? -1) + 1;
        }
        $lesson->save();
        $lesson->protocols()->sync($data['protocols'] ?? []);
    }

    private function hasLearnerData(Lesson $lesson): bool
    {
        return LabSession::where('lab_slug', $lesson->slug)->where('lab_type', 'scenario')->exists()
            || LessonVisit::where('lesson_slug', $lesson->slug)->exists();
    }

    private function options(ScenarioCatalog $scenarios): array
    {
        return [
            'courses' => Course::orderBy('sort')->get(['id', 'title']),
            'scenarios' => collect($scenarios->options())->map(fn ($title, $key) => ['key' => $key, 'title' => $title])->values(),
            'quizzes' => Quiz::orderBy('title')->get(['id', 'slug', 'title']),
            'terms' => TechnicalTerm::orderBy('term')->get(['slug', 'term']),
            'protocols' => Protocol::orderBy('acronym')->get(['id', 'acronym', 'name']),
        ];
    }
}
