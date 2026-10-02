<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Diagnostic;
use App\Models\LabSession;
use App\Models\Lesson;
use App\Models\Quiz;
use App\Models\User;
use App\Services\Learning\ContentResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/** Espace étudiant : toutes les données affichées appartiennent à l'utilisateur connecté. */
class StudentController extends Controller
{
    public function __construct(private readonly ContentResolver $resolver) {}

    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        $sessions = $user->labSessions()->latest('last_activity_at')->get();
        $resume = $sessions->firstWhere('status', 'in_progress');
        $attempts = $user->quizAttempts()->latest('created_at')->limit(5)->get();
        $favorites = $user->favorites()->latest('created_at')->limit(6)->get();

        $describe = $this->resolver->describe([
            ...$sessions->take(6)->map(fn (LabSession $s) => [$s->lab_type === 'scenario' ? 'lab' : 'diagnostic', $s->lab_slug]),
            ...$attempts->map(fn ($a) => ['quiz', $a->quiz_slug]),
            ...$favorites->map(fn ($f) => [$f->subject_type, $f->subject_slug]),
        ]);

        $labsTotal = Lesson::query()->published()->where('kind', 'scenario')->whereNotNull('scenario_key')->count();
        $completedLabs = $sessions->where('lab_type', 'scenario')->where('status', 'completed')->pluck('lab_slug')->unique()->count();
        $startedLabs = $sessions->where('lab_type', 'scenario')->pluck('lab_slug')->unique()->count();
        $solvedDiagnostics = $sessions->where('lab_type', 'diagnostic')->where('status', 'completed')->pluck('lab_slug')->unique()->count();

        return Inertia::render('app/dashboard', [
            'stats' => [
                'lessons_started' => $user->lessonVisits()->count(),
                'labs_started' => $startedLabs,
                'labs_completed' => $completedLabs,
                'labs_total' => $labsTotal,
                'diagnostics_solved' => $solvedDiagnostics,
                'diagnostics_total' => Diagnostic::query()->published()->count(),
                'quiz_attempts' => $user->quizAttempts()->count(),
                'quiz_average' => $this->average($user),
            ],
            'resume' => $resume ? $this->sessionItem($resume, $describe) : null,
            'recentLabs' => $sessions->take(4)->map(fn (LabSession $s) => $this->sessionItem($s, $describe))->values(),
            'recentResults' => $attempts->map(fn ($a) => [
                'id' => $a->id, 'quiz' => $describe["quiz:{$a->quiz_slug}"] ?? ['title' => $a->quiz_slug, 'href' => null],
                'score' => $a->score, 'total' => $a->total, 'percent' => $a->percent(), 'date' => $a->created_at->toIso8601String(),
            ]),
            'favorites' => $favorites->map(fn ($f) => ['type' => $f->subject_type, 'slug' => $f->subject_slug, ...($describe["{$f->subject_type}:{$f->subject_slug}"] ?? ['title' => $f->subject_slug, 'href' => null])]),
            'recommendations' => $this->recommendations($user, $sessions),
        ]);
    }

    public function progress(Request $request): Response
    {
        $user = $request->user();
        $sessions = $user->labSessions()->get()->groupBy(fn (LabSession $s) => $s->lab_type.':'.$s->lab_slug);
        $visits = $user->lessonVisits()->get()->keyBy('lesson_slug');
        $best = $user->quizAttempts()->get()->groupBy('quiz_slug')->map(fn (Collection $items) => $items->max(fn ($a) => $a->percent()));

        $courses = Course::query()->published()->with(['lessons' => fn ($q) => $q->published()->with('quiz')])->orderBy('sort')->get()
            ->map(function (Course $course) use ($sessions, $visits, $best) {
                $lessons = $course->lessons->map(function (Lesson $lesson) use ($sessions, $visits, $best) {
                    $labSessions = $sessions->get('scenario:'.$lesson->slug, collect());
                    $completed = $labSessions->firstWhere('status', 'completed') !== null;
                    $latest = $labSessions->sortByDesc('last_activity_at')->first();

                    return [
                        ...$lesson->toSummary(),
                        'visited' => $visits->has($lesson->slug),
                        'lab' => $lesson->isLab() ? ['completed' => $completed, 'progress' => $completed ? 100 : ($latest?->progressPercent() ?? 0), 'started' => $latest !== null] : null,
                        'quiz' => $lesson->quiz ? ['slug' => $lesson->quiz->slug, 'best' => $best->get($lesson->quiz->slug)] : null,
                    ];
                });
                $done = $lessons->filter(fn ($l) => $l['lab'] ? $l['lab']['completed'] : $l['visited'])->count();

                return ['slug' => $course->slug, 'title' => $course->title, 'description' => $course->description, 'lessons' => $lessons, 'done' => $done, 'total' => $lessons->count()];
            });

        $diagnostics = Diagnostic::query()->published()->orderBy('sort')->get(['slug', 'title', 'difficulty'])->map(function (Diagnostic $d) use ($sessions) {
            $session = $sessions->get('diagnostic:'.$d->slug)?->sortByDesc('last_activity_at')->first();

            return [...$d->only(['slug', 'title', 'difficulty']), 'status' => $session?->status, 'attempts' => $session?->attempts, 'hints' => $session?->hints_used];
        });

        return Inertia::render('app/progress', ['courses' => $courses, 'diagnostics' => $diagnostics]);
    }

    public function favorites(Request $request): Response
    {
        $favorites = $request->user()->favorites()->latest('created_at')->get();
        $describe = $this->resolver->describe($favorites->map(fn ($f) => [$f->subject_type, $f->subject_slug]));

        return Inertia::render('app/favorites', [
            'favorites' => $favorites->map(fn ($f) => [
                'type' => $f->subject_type, 'slug' => $f->subject_slug, 'date' => $f->created_at->toIso8601String(),
                ...($describe["{$f->subject_type}:{$f->subject_slug}"] ?? ['title' => $f->subject_slug, 'href' => null, 'exists' => false]),
            ]),
        ]);
    }

    public function results(Request $request): Response
    {
        $user = $request->user();
        $attempts = $user->quizAttempts()->latest('created_at')->limit(200)->get();
        $describe = $this->resolver->describe($attempts->map(fn ($a) => ['quiz', $a->quiz_slug]));
        $diagnostics = $user->labSessions()->where('lab_type', 'diagnostic')->latest('last_activity_at')->get();
        $describeDiag = $this->resolver->describe($diagnostics->map(fn ($s) => ['diagnostic', $s->lab_slug]));

        return Inertia::render('app/results', [
            'attempts' => $attempts->map(fn ($a) => [
                'id' => $a->id, 'slug' => $a->quiz_slug, 'quiz' => $describe["quiz:{$a->quiz_slug}"] ?? ['title' => $this->generatedTitle($a->quiz_slug), 'href' => $this->generatedHref($a->quiz_slug)],
                'score' => $a->score, 'total' => $a->total, 'percent' => $a->percent(), 'duration' => $a->duration_seconds, 'date' => $a->created_at->toIso8601String(),
            ]),
            'diagnostics' => $diagnostics->map(fn ($s) => [
                'id' => $s->id, 'diagnostic' => $describeDiag["diagnostic:{$s->lab_slug}"] ?? ['title' => $s->lab_slug, 'href' => null],
                'status' => $s->status, 'attempts' => $s->attempts, 'hints' => $s->hints_used, 'date' => $s->last_activity_at->toIso8601String(),
            ]),
            'average' => $this->average($user),
        ]);
    }

    public function history(Request $request): Response
    {
        $user = $request->user();
        $items = collect();
        foreach ($user->labSessions()->latest('last_activity_at')->limit(100)->get() as $s) {
            $items->push(['kind' => $s->lab_type === 'scenario' ? 'lab' : 'diagnostic', 'type' => $s->lab_type === 'scenario' ? 'lab' : 'diagnostic', 'slug' => $s->lab_slug, 'status' => $s->status, 'progress' => $s->progressPercent(), 'date' => $s->last_activity_at]);
        }
        foreach ($user->quizAttempts()->latest('created_at')->limit(100)->get() as $a) {
            $items->push(['kind' => 'quiz', 'type' => 'quiz', 'slug' => $a->quiz_slug, 'status' => 'completed', 'progress' => $a->percent(), 'date' => $a->created_at]);
        }
        foreach ($user->lessonVisits()->latest('last_visited_at')->limit(100)->get() as $v) {
            $items->push(['kind' => 'lesson', 'type' => 'lesson', 'slug' => $v->lesson_slug, 'status' => 'visited', 'progress' => null, 'visits' => $v->visits, 'date' => $v->last_visited_at]);
        }
        $items = $items->sortByDesc('date')->take(150)->values();
        $describe = $this->resolver->describe($items->map(fn ($i) => [$i['type'], $i['slug']]));

        return Inertia::render('app/history', [
            'items' => $items->map(fn ($i) => [
                ...$i, 'date' => $i['date']->toIso8601String(),
                ...($describe["{$i['type']}:{$i['slug']}"] ?? ['title' => $i['type'] === 'quiz' ? $this->generatedTitle($i['slug']) : $i['slug'], 'href' => $i['type'] === 'quiz' ? $this->generatedHref($i['slug']) : null]),
            ]),
        ]);
    }

    /** @param array<string, array<string, mixed>> $describe */
    private function sessionItem(LabSession $session, array $describe): array
    {
        $type = $session->lab_type === 'scenario' ? 'lab' : 'diagnostic';
        $info = $describe["{$type}:{$session->lab_slug}"] ?? ['title' => $session->lab_slug, 'href' => null];

        return [...$session->toPublicArray(), 'title' => $info['title'], 'href' => $info['href']];
    }

    private function average(User $user): ?int
    {
        $attempts = $user->quizAttempts()->get(['score', 'total']);
        if ($attempts->isEmpty()) {
            return null;
        }

        return (int) round($attempts->avg(fn ($a) => $a->total > 0 ? $a->score / $a->total * 100 : 0));
    }

    /** Prochaines activités suggérées : simples règles explicables, pas de « magie ». */
    private function recommendations(User $user, Collection $sessions): array
    {
        $doneLabs = $sessions->where('lab_type', 'scenario')->where('status', 'completed')->pluck('lab_slug')->all();
        $startedLabs = $sessions->where('lab_type', 'scenario')->pluck('lab_slug')->all();
        $out = [];

        $nextLab = Lesson::query()->published()->where('lessons.kind', 'scenario')->whereNotNull('lessons.scenario_key')->whereNotIn('lessons.slug', $startedLabs)
            ->leftJoin('courses', 'courses.id', '=', 'lessons.course_id')
            ->orderBy('courses.sort')->orderBy('lessons.sort')->select('lessons.*')->first();
        if ($nextLab) {
            $out[] = ['kind' => 'lab', 'title' => $nextLab->title, 'href' => '/laboratoire/'.$nextLab->slug, 'reason' => 'Prochain TP du parcours, pas encore commencé.'];
        }

        $weak = $user->quizAttempts()->get()->groupBy('quiz_slug')->map(fn ($items) => $items->max(fn ($a) => $a->percent()))->filter(fn ($best) => $best < 60)->keys()->first();
        if ($weak && ($quiz = Quiz::query()->published()->where('slug', $weak)->first())) {
            $out[] = ['kind' => 'quiz', 'title' => $quiz->title, 'href' => '/quiz/'.$quiz->slug, 'reason' => 'Ton meilleur score est sous 60 % : un nouvel essai aidera à consolider.'];
        }

        $solved = $sessions->where('lab_type', 'diagnostic')->where('status', 'completed')->pluck('lab_slug')->all();
        if (count($doneLabs) > 0 && ($diagnostic = Diagnostic::query()->published()->whereNotIn('slug', $solved)->orderBy('sort')->first())) {
            $out[] = ['kind' => 'diagnostic', 'title' => $diagnostic->title, 'href' => '/diagnostic/'.$diagnostic->slug, 'reason' => 'Mets tes connaissances en pratique sur une panne réaliste.'];
        }

        return array_slice($out, 0, 3);
    }

    private function generatedTitle(string $slug): string
    {
        return str_starts_with($slug, 'protocole-') ? 'Quiz de la fiche '.strtoupper(substr($slug, 10)) : $slug;
    }

    private function generatedHref(string $slug): ?string
    {
        return str_starts_with($slug, 'protocole-') ? '/protocoles/'.substr($slug, 10) : null;
    }
}
