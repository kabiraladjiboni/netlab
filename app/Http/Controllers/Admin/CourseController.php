<?php

namespace App\Http\Controllers\Admin;

use App\Models\Course;
use App\Models\LabSession;
use App\Models\Lesson;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Cours (parcours) et organisation de leurs chapitres (leçons). */
class CourseController extends AdminController
{
    public function index(): Response
    {
        $labCounts = LabSession::query()->where('lab_type', 'scenario')->selectRaw('lab_slug, COUNT(*) as n')->groupBy('lab_slug')->pluck('n', 'lab_slug');

        return Inertia::render('admin/courses/index', [
            'courses' => Course::with(['lessons' => fn ($q) => $q->with('quiz:id,slug')])->orderBy('sort')->get()->map(fn (Course $course) => [
                'id' => $course->id, 'slug' => $course->slug, 'title' => $course->title, 'description' => $course->description,
                'level' => $course->level, 'status' => $course->status_publication, 'sort' => $course->sort,
                'lessons' => $course->lessons->map(fn (Lesson $lesson) => [
                    'id' => $lesson->id, 'slug' => $lesson->slug, 'title' => $lesson->title, 'kind' => $lesson->kind,
                    'status' => $lesson->status_publication, 'scenario_key' => $lesson->scenario_key, 'quiz' => $lesson->quiz?->slug,
                    'href' => $lesson->href, 'lab_sessions' => (int) ($labCounts[$lesson->slug] ?? 0),
                ])->values(),
            ]),
            'orphans' => Lesson::whereNull('course_id')->orderBy('title')->get(['id', 'slug', 'title', 'status_publication']),
            'levels' => Course::LEVELS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $course = Course::create([...$data, 'sort' => (Course::max('sort') ?? 0) + 1]);
        $this->log($request, 'course.created', 'course', $course->title);

        return back()->with('success', 'Cours créé.');
    }

    public function update(Request $request, Course $course): RedirectResponse
    {
        $data = $this->validated($request, $course);
        $before = $course->status_publication;
        $course->update($data);
        $this->log($request, $before !== $course->status_publication ? 'course.'.($course->status_publication === 'published' ? 'published' : 'unpublished') : 'course.updated', 'course', $course->title);

        return back()->with('success', 'Cours enregistré.');
    }

    public function reorder(Request $request, Course $course): RedirectResponse
    {
        $data = $request->validate(['lessons' => ['required', 'array'], 'lessons.*' => ['integer', Rule::exists('lessons', 'id')]]);
        foreach ($data['lessons'] as $position => $id) {
            Lesson::whereKey($id)->update(['course_id' => $course->id, 'sort' => $position]);
        }
        $this->log($request, 'course.reordered', 'course', $course->title);

        return back()->with('success', 'Ordre des chapitres enregistré.');
    }

    public function destroy(Request $request, Course $course): RedirectResponse
    {
        if ($course->lessons()->exists()) {
            return back()->with('error', 'Ce cours contient des chapitres : déplace-les ou dépublie le cours.');
        }
        $course->delete();
        $this->log($request, 'course.deleted', 'course', $course->title);

        return back()->with('success', 'Cours supprimé.');
    }

    private function validated(Request $request, ?Course $course = null): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'slug' => [...$this->slugRule(), Rule::unique('courses', 'slug')->ignore($course?->id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'level' => ['required', Rule::in(array_keys(Course::LEVELS))],
            'status_publication' => ['required', Rule::in(['draft', 'published'])],
        ]);
    }
}
