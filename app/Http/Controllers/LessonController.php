<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ProvidesEngagement;
use App\Models\Lesson;
use App\Services\Analytics\Tracker;
use App\Services\Learning\LabAccess;
use App\Services\Learning\ProgressService;
use App\Services\Learning\ScenarioCatalog;
use App\Services\Platform\Settings;
use App\Support\Presenters\ContentPresenter;
use App\Support\Seo\Seo;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Page publique d'une leçon animée : objectif, notions, aperçu limité de
 * l'animation et accès au TP complet (réservé aux comptes).
 */
class LessonController extends Controller
{
    use ProvidesEngagement;

    public function show(Request $request, string $slug, Tracker $tracker, LabAccess $access, ScenarioCatalog $scenarios, Settings $settings, ProgressService $progress): Response
    {
        $user = $request->user();
        $lesson = Lesson::with(['quiz', 'course', 'protocols.layers', 'protocols.category'])->where('slug', $slug)->where('kind', 'scenario')->firstOrFail();
        $this->ensureVisible($user, $lesson->isPublished());

        $siblings = Lesson::query()->published()
            ->when($lesson->course_id, fn ($query) => $query->where('course_id', $lesson->course_id), fn ($query) => $query->where('track', $lesson->track))
            ->orderBy('sort')->get();
        $index = $siblings->search(fn (Lesson $item) => $item->id === $lesson->id);

        $tracker->recordOnce($request, 'lesson_view', 'lesson', $lesson->slug);
        if ($user !== null) {
            $progress->visitLesson($user, $lesson->slug);
        }

        $seo = app(Seo::class);
        $seo->title($lesson->title)
            ->description($lesson->objective.' Leçon animée gratuite, en français.')
            ->type('article')
            ->modified($lesson->updated_at)
            ->breadcrumbs(array_values(array_filter([
                ['Cours', '/apprendre'],
                $lesson->course ? [$lesson->course->title, '/cours/'.$lesson->course->slug] : null,
                [$lesson->title, '/lecons/'.$lesson->slug],
            ])))
            ->schema(array_filter([
                '@type' => 'LearningResource',
                'name' => $lesson->title,
                'description' => Seo::clean((string) $lesson->objective),
                'url' => $seo->url('/lecons/'.$lesson->slug),
                'inLanguage' => 'fr',
                'isAccessibleForFree' => true,
                'learningResourceType' => 'Animation interactive',
                'interactivityType' => 'mixed',
                'timeRequired' => Seo::duration($lesson->duration),
                'teaches' => array_values((array) ($lesson->concepts ?? [])),
                'isPartOf' => $lesson->course ? ['@type' => 'Course', 'name' => $lesson->course->title, 'url' => $seo->url('/cours/'.$lesson->course->slug)] : null,
                'provider' => ['@id' => $seo->baseUrl().'/#organisation'],
            ], fn ($value) => $value !== null && $value !== []));
        if (! $lesson->isPublished()) {
            $seo->noindex();
        }

        $session = $user?->labSessions()->where('lab_type', 'scenario')->where('lab_slug', $lesson->slug)->latest('last_activity_at')->first();
        $protocols = $lesson->protocols->isNotEmpty() ? $lesson->protocols : \App\Models\Protocol::with(['layers', 'category'])->published()->where('lesson_slug', $lesson->slug)->orderBy('sort')->get();

        return Inertia::render('lessons/show', [
            'lesson' => [
                ...$lesson->toSummary(),
                'concepts' => $lesson->concepts,
                'intro' => $lesson->intro,
                'references' => $lesson->references ?? [],
                'course' => $lesson->course ? ['slug' => $lesson->course->slug, 'title' => $lesson->course->title] : null,
                'draft' => ! $lesson->isPublished(),
            ],
            'quiz' => $lesson->quiz?->isPublished() ? $lesson->quiz->toPayload() : null,
            'protocols' => $protocols->map(fn ($protocol) => ContentPresenter::protocolSummary($protocol))->values(),
            'previous' => $index !== false && $index > 0 ? $siblings[$index - 1]->toSummary() : null,
            'next' => $index !== false ? $siblings->get($index + 1)?->toSummary() : null,
            'access' => $access->status($user),
            'labAvailable' => $lesson->isLab() && $scenarios->isPublished($lesson->scenario_key),
            'previewSteps' => (int) $settings->get('labs.preview_steps'),
            'customScenario' => $lesson->scenario_key ? $scenarios->customDefinition($lesson->scenario_key, (bool) $user?->isAdmin()) : null,
            'session' => $session?->toPublicArray(),
            'engagement' => $this->engagement($user, 'lesson', $lesson->slug),
        ]);
    }
}
