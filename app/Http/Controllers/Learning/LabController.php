<?php

namespace App\Http\Controllers\Learning;

use App\Http\Controllers\Concerns\ProvidesEngagement;
use App\Http\Controllers\Controller;
use App\Models\Diagnostic;
use App\Models\LabSession;
use App\Models\Lesson;
use App\Services\Learning\LabAccess;
use App\Services\Learning\ScenarioCatalog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Laboratoire : catalogue des TP, séance interactive et résultats. */
class LabController extends Controller
{
    use ProvidesEngagement;

    public function index(Request $request, LabAccess $access, ScenarioCatalog $scenarios): Response
    {
        $user = $request->user();
        $sessions = $user ? $user->labSessions()->get()->groupBy(fn (LabSession $session) => $session->lab_type.':'.$session->lab_slug) : collect();
        $status = function (string $type, string $slug) use ($sessions) {
            $items = $sessions->get($type.':'.$slug);
            if ($items === null) {
                return null;
            }
            $completed = $items->firstWhere('status', 'completed');
            $latest = $items->sortByDesc('last_activity_at')->first();

            return ['completed' => $completed !== null, 'progress' => $completed ? 100 : $latest->progressPercent()];
        };

        $labs = Lesson::query()->published()->where('kind', 'scenario')->whereNotNull('scenario_key')->orderBy('sort')->get()
            ->filter(fn (Lesson $lesson) => $scenarios->isPublished($lesson->scenario_key))
            ->map(fn (Lesson $lesson) => [...$lesson->toSummary(), 'concepts' => $lesson->concepts, 'status' => $status('scenario', $lesson->slug)])
            ->values();

        $diagnostics = Diagnostic::query()->published()->orderBy('sort')->get(['slug', 'title', 'difficulty', 'summary'])
            ->map(fn (Diagnostic $diagnostic) => [...$diagnostic->only(['slug', 'title', 'difficulty', 'summary']), 'status' => $status('diagnostic', $diagnostic->slug)]);

        $seo = app(\App\Support\Seo\Seo::class);
        $seo->title('Laboratoire réseau virtuel : '.$labs->count().' TP interactifs gratuits')
            ->description('Des travaux pratiques virtuels pour manipuler les réseaux : suis les paquets DNS, TCP, TLS, DHCP, NAT ou VLAN étape par étape, puis résous des pannes. Gratuit, en français.')
            ->breadcrumbs([['Laboratoire', '/laboratoire']])
            ->schema([
                '@type' => 'ItemList',
                'name' => 'Travaux pratiques réseau',
                'itemListElement' => $labs->values()->map(fn (array $lab, int $i) => ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $lab['title'], 'url' => $seo->url('/lecons/'.$lab['slug'])])->all(),
            ]);

        return Inertia::render('lab/index', [
            'labs' => $labs,
            'diagnostics' => $diagnostics,
            'access' => $access->status($user),
        ]);
    }

    public function show(Request $request, string $slug, ScenarioCatalog $scenarios): Response
    {
        $user = $request->user();
        $lesson = Lesson::with('quiz')->where('slug', $slug)->where('kind', 'scenario')->whereNotNull('scenario_key')->firstOrFail();
        $this->ensureVisible($user, $lesson->isPublished() && $scenarios->isPublished($lesson->scenario_key));

        app(\App\Services\Learning\ProgressService::class)->visitLesson($user, $lesson->slug);
        $session = $user->labSessions()->where('lab_type', 'scenario')->where('lab_slug', $slug)->where('status', 'in_progress')->latest('last_activity_at')->first();
        $completedCount = $user->labSessions()->where('lab_type', 'scenario')->where('lab_slug', $slug)->where('status', 'completed')->count();

        return Inertia::render('lab/show', [
            'lesson' => [...$lesson->toSummary(), 'concepts' => $lesson->concepts],
            'quiz' => $lesson->quiz?->isPublished() ? $lesson->quiz->toPayload() : null,
            'customScenario' => $scenarios->customDefinition($lesson->scenario_key, $user->isAdmin()),
            'resume' => $session?->toPublicArray(),
            'completedCount' => $completedCount,
            'initialVariant' => $request->string('variante')->limit(40)->toString() ?: $session?->variant,
            'engagement' => $this->engagement($user, 'lab', $slug),
        ]);
    }

    public function results(Request $request, string $slug): Response
    {
        $user = $request->user();
        $lesson = Lesson::with('quiz')->where('slug', $slug)->where('kind', 'scenario')->firstOrFail();

        // Uniquement les données de l'utilisateur connecté.
        $sessions = $user->labSessions()->where('lab_type', 'scenario')->where('lab_slug', $slug)->latest('started_at')->limit(20)->get();
        $attempts = $lesson->quiz ? $user->quizAttempts()->where('quiz_slug', $lesson->quiz->slug)->latest('created_at')->limit(20)->get() : collect();

        return Inertia::render('lab/results', [
            'lesson' => $lesson->toSummary(),
            'sessions' => $sessions->map->toPublicArray(),
            'quiz' => $lesson->quiz ? ['slug' => $lesson->quiz->slug, 'title' => $lesson->quiz->title] : null,
            'attempts' => $attempts->map(fn ($attempt) => ['id' => $attempt->id, 'score' => $attempt->score, 'total' => $attempt->total, 'percent' => $attempt->percent(), 'date' => $attempt->created_at->toIso8601String()]),
        ]);
    }
}
