<?php

namespace App\Services\Analytics;

use App\Models\ContentRating;
use App\Models\Course;
use App\Models\Favorite;
use App\Models\FeedbackReport;
use App\Models\LabSession;
use App\Models\Lesson;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Services\Learning\ContentResolver;
use App\Services\Platform\Settings;
use App\Support\Countries;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Indicateurs de l'administration, calculés uniquement à partir des données
 * enregistrées. Chaque indicateur est accompagné de sa définition, affichée
 * dans l'interface, pour éviter les confusions (compte ≠ visiteur ≠ actif).
 */
class Metrics
{
    public function __construct(private readonly Settings $settings, private readonly ContentResolver $resolver) {}

    /* ------------------------------------------------------------------ */
    /* Présence                                                             */
    /* ------------------------------------------------------------------ */

    public function presence(): array
    {
        $window = (int) $this->settings->get('analytics.presence_window');
        $since = now()->subMinutes($window);
        $sessions = DB::table('visitor_sessions')->where('last_seen_at', '>=', $since);

        return [
            'window_minutes' => $window,
            'active_sessions' => (clone $sessions)->count(),
            'active_students' => (clone $sessions)->whereNotNull('user_id')->distinct()->count('user_id'),
            'recent_students' => User::query()->where('last_active_at', '>=', now()->subMinutes(30))->count(),
            'last_activity' => DB::table('visitor_sessions')->max('last_seen_at'),
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Tableau de bord                                                      */
    /* ------------------------------------------------------------------ */

    public function overview(Period $period): array
    {
        [$from, $to] = [$period->from, $period->to];
        $events = fn () => DB::table('analytics_events')->whereBetween('occurred_at', [$from, $to]);

        $labsStarted = LabSession::query()->where('lab_type', 'scenario')->whereBetween('started_at', [$from, $to]);
        $startedCount = (clone $labsStarted)->count();
        $completedFromStarted = (clone $labsStarted)->where('status', 'completed')->count();

        $sessionDurations = DB::table('visitor_sessions')->whereBetween('first_seen_at', [$from, $to])->where('signals', '>=', 2)
            ->limit(50000)->get(['first_seen_at', 'last_seen_at'])
            ->map(fn ($row) => max(0, strtotime($row->last_seen_at) - strtotime($row->first_seen_at)));
        $labDurations = LabSession::query()->where('status', 'completed')->whereBetween('completed_at', [$from, $to])->pluck('active_seconds');
        $quiz = QuizAttempt::query()->whereBetween('created_at', [$from, $to])->get(['score', 'total']);

        return [
            'students_total' => User::query()->where('role', User::ROLE_STUDENT)->count(),
            'signups' => User::query()->where('role', User::ROLE_STUDENT)->whereBetween('created_at', [$from, $to])->count(),
            'active_users' => $events()->whereNotNull('user_id')->distinct()->count('user_id'),
            'unique_visitors' => $this->dailyUniqueVisitors($period),
            'page_views' => $events()->where('type', 'page_view')->count(),
            'lesson_views' => $events()->where('type', 'lesson_view')->count(),
            'labs_started' => $startedCount,
            'labs_completed' => LabSession::query()->where('lab_type', 'scenario')->where('status', 'completed')->whereBetween('completed_at', [$from, $to])->count(),
            'completion_rate' => $startedCount > 0 ? (int) round($completedFromStarted / $startedCount * 100) : null,
            'quizzes' => $quiz->count(),
            'quiz_average' => $quiz->isEmpty() ? null : (int) round($quiz->avg(fn ($a) => $a->total ? $a->score / $a->total * 100 : 0)),
            'diagnostics_solved' => LabSession::query()->where('lab_type', 'diagnostic')->where('status', 'completed')->whereBetween('completed_at', [$from, $to])->count(),
            'session_median_seconds' => $this->median($sessionDurations),
            'lab_median_seconds' => $this->median($labDurations),
            'ratings' => ContentRating::query()->whereBetween('updated_at', [$from, $to])->count(),
            'feedback_open' => FeedbackReport::query()->whereIn('status', ['new', 'in_progress'])->count(),
        ];
    }

    /** Somme des visiteurs uniques de chaque jour (l'empreinte change chaque jour). */
    private function dailyUniqueVisitors(Period $period): int
    {
        return (int) DB::table('analytics_events')
            ->whereBetween('occurred_at', [$period->from, $period->to])->whereNotNull('visitor_hash')
            ->selectRaw('DATE(occurred_at) as day, COUNT(DISTINCT visitor_hash) as n')->groupBy('day')->get()->sum('n');
    }

    /** @return array<string, list<array{day: string, value: int}>> */
    public function series(Period $period): array
    {
        $days = $period->days();
        $fill = function (Collection $rows) use ($days) {
            $map = $rows->pluck('n', 'day');

            return array_map(fn ($day) => ['day' => $day, 'value' => (int) ($map[$day] ?? 0)], $days);
        };
        $daily = fn ($query, string $column, string $count = 'COUNT(*)') => $fill(
            $query->whereBetween($column, [$period->from, $period->to])->selectRaw("DATE({$column}) as day, {$count} as n")->groupBy('day')->get()
        );

        return [
            'signups' => $daily(DB::table('users')->where('role', User::ROLE_STUDENT), 'created_at'),
            'page_views' => $daily(DB::table('analytics_events')->where('type', 'page_view'), 'occurred_at'),
            'active_users' => $daily(DB::table('analytics_events')->whereNotNull('user_id'), 'occurred_at', 'COUNT(DISTINCT user_id)'),
            'active_sessions' => $daily(DB::table('analytics_events')->whereNotNull('session_hash'), 'occurred_at', 'COUNT(DISTINCT session_hash)'),
            'lesson_views' => $daily(DB::table('analytics_events')->where('type', 'lesson_view'), 'occurred_at'),
            'labs_started' => $daily(DB::table('lab_sessions')->where('lab_type', 'scenario'), 'started_at'),
            'labs_completed' => $daily(DB::table('lab_sessions')->where('lab_type', 'scenario')->where('status', 'completed'), 'completed_at'),
            'quizzes' => $daily(DB::table('quiz_attempts'), 'created_at'),
        ];
    }

    /** Activité (consultations + TP lancés) répartie par cours. */
    public function activityByCourse(Period $period): array
    {
        $lessons = Lesson::query()->get(['slug', 'course_id'])->pluck('course_id', 'slug');
        $courses = Course::query()->pluck('title', 'id');
        $views = DB::table('analytics_events')->where('type', 'lesson_view')->whereBetween('occurred_at', [$period->from, $period->to])
            ->selectRaw('subject_slug, COUNT(*) as n')->groupBy('subject_slug')->pluck('n', 'subject_slug');
        $labs = LabSession::query()->where('lab_type', 'scenario')->whereBetween('started_at', [$period->from, $period->to])
            ->selectRaw('lab_slug, COUNT(*) as n')->groupBy('lab_slug')->pluck('n', 'lab_slug');

        $out = [];
        foreach ([[$views, 'views'], [$labs, 'labs']] as [$rows, $key]) {
            foreach ($rows as $slug => $count) {
                $title = $courses[$lessons[$slug] ?? 0] ?? 'Sans cours';
                $out[$title] ??= ['course' => $title, 'views' => 0, 'labs' => 0];
                $out[$title][$key] += $count;
            }
        }

        return array_values(collect($out)->sortByDesc(fn ($row) => $row['views'] + $row['labs'])->all());
    }

    /* ------------------------------------------------------------------ */
    /* Audience géographique                                               */
    /* ------------------------------------------------------------------ */

    public function geography(Period $period): array
    {
        $sessions = DB::table('visitor_sessions')->whereBetween('first_seen_at', [$period->from, $period->to]);
        $total = (clone $sessions)->count();
        $byCountry = (clone $sessions)->whereNotNull('country')
            ->selectRaw('country, COUNT(*) as sessions, COUNT(DISTINCT user_id) as students')->groupBy('country')->orderByDesc('sessions')->get();
        $known = (int) $byCountry->sum('sessions');

        $top = $byCountry->take(5)->pluck('country')->all();
        $weekly = [];
        if ($top !== []) {
            $rows = (clone $sessions)->whereIn('country', $top)->get(['country', 'first_seen_at']);
            foreach ($rows as $row) {
                $week = date('o-\SW', strtotime($row->first_seen_at));
                $weekly[$week][$row->country] = ($weekly[$week][$row->country] ?? 0) + 1;
            }
            ksort($weekly);
        }

        return [
            'available' => app(GeoIp::class)->available(),
            'sessions_total' => $total,
            'sessions_unknown' => $total - $known,
            'countries' => $byCountry->map(fn ($row) => [
                'code' => $row->country, 'name' => Countries::name($row->country),
                'sessions' => (int) $row->sessions, 'students' => (int) $row->students,
                'share' => $total > 0 ? round($row->sessions / $total * 100, 1) : 0,
            ])->values()->all(),
            'weekly' => ['countries' => array_map(fn ($code) => ['code' => $code, 'name' => Countries::name($code)], $top), 'rows' => collect($weekly)->map(fn ($values, $week) => ['week' => $week, 'values' => $values])->values()->all()],
            'declared' => User::query()->whereNotNull('country')->selectRaw('country, COUNT(*) as n')->groupBy('country')->orderByDesc('n')->limit(15)->get()
                ->map(fn ($row) => ['code' => $row->country, 'name' => Countries::name($row->country), 'students' => (int) $row->n])->all(),
        ];
    }

    /** Répartition des signaux d'activité par heure de la journée (heure du serveur). */
    public function hourly(Period $period): array
    {
        $hours = array_fill(0, 24, 0);
        DB::table('analytics_events')->where('type', 'page_view')->whereBetween('occurred_at', [$period->from, $period->to])
            ->orderBy('id')->limit(200000)->pluck('occurred_at')
            ->each(function ($at) use (&$hours) {
                $hours[(int) date('G', strtotime($at))]++;
            });

        return array_map(fn ($hour, $count) => ['hour' => $hour, 'value' => $count], array_keys($hours), $hours);
    }

    /* ------------------------------------------------------------------ */
    /* Apprentissage et engagement                                        */
    /* ------------------------------------------------------------------ */

    public function learning(Period $period): array
    {
        [$from, $to] = [$period->from, $period->to];
        $topEvents = fn (string $type, int $limit = 10) => DB::table('analytics_events')->where('type', $type)->whereBetween('occurred_at', [$from, $to])
            ->selectRaw('subject_slug, COUNT(*) as n')->groupBy('subject_slug')->orderByDesc('n')->limit($limit)->get();

        $lessonViews = $topEvents('lesson_view');
        $protocolViews = $topEvents('protocol_view');

        $labs = LabSession::query()->where('lab_type', 'scenario')->whereBetween('started_at', [$from, $to])->get(['lab_slug', 'status', 'steps_seen', 'total_steps', 'last_activity_at', 'active_seconds']);
        $labRows = $labs->groupBy('lab_slug')->map(function (Collection $items, string $slug) {
            $completed = $items->where('status', 'completed');
            // Abandon : séance non terminée et inactive depuis plus de 7 jours.
            $abandoned = $items->filter(fn ($s) => $s->status !== 'completed' && $s->last_activity_at->lt(now()->subDays(7)));
            $stops = $abandoned->map(fn ($s) => count($s->steps_seen ?? []))->countBy()->sortDesc();

            return [
                'slug' => $slug,
                'started' => $items->count(),
                'completed' => $completed->count(),
                'rate' => (int) round($completed->count() / max(1, $items->count()) * 100),
                'abandoned' => $abandoned->count(),
                'common_stop' => $stops->isEmpty() ? null : ['steps_seen' => (int) $stops->keys()->first(), 'count' => (int) $stops->first(), 'total' => (int) $items->first()->total_steps],
                'median_active' => $this->median($completed->pluck('active_seconds')),
            ];
        })->sortByDesc('started')->values();

        $quizRows = QuizAttempt::query()->whereBetween('created_at', [$from, $to])->get(['quiz_slug', 'score', 'total', 'user_id'])
            ->groupBy('quiz_slug')->map(fn (Collection $items, string $slug) => [
                'slug' => $slug,
                'attempts' => $items->count(),
                'students' => $items->pluck('user_id')->unique()->count(),
                'average' => (int) round($items->avg(fn ($a) => $a->total ? $a->score / $a->total * 100 : 0)),
                'median' => $this->median($items->map(fn ($a) => $a->total ? (int) round($a->score / $a->total * 100) : 0)),
            ])->sortByDesc('attempts')->values();

        $favorites = Favorite::query()->selectRaw('subject_type, subject_slug, COUNT(*) as n')->groupBy('subject_type', 'subject_slug')->orderByDesc('n')->limit(10)->get();
        $ratings = ContentRating::query()->selectRaw("subject_type, subject_slug, SUM(CASE WHEN value = 'useful' THEN 1 ELSE 0 END) as useful, SUM(CASE WHEN value = 'unclear' THEN 1 ELSE 0 END) as unclear")
            ->groupBy('subject_type', 'subject_slug')->get()->sortByDesc(fn ($r) => $r->useful + $r->unclear)->take(15)->values();

        $searches = DB::table('analytics_events')->where('type', 'search')->whereBetween('occurred_at', [$from, $to])->where('subject_slug', '!=', '[masqué]');
        $topSearches = (clone $searches)->selectRaw('subject_slug, COUNT(*) as n')->groupBy('subject_slug')->orderByDesc('n')->limit(12)->get();
        $emptySearches = (clone $searches)->where('value', 0)->selectRaw('subject_slug, COUNT(*) as n')->groupBy('subject_slug')->orderByDesc('n')->limit(12)->get();

        $describe = $this->resolver->describe([
            ...$lessonViews->map(fn ($r) => ['lesson', $r->subject_slug]),
            ...$protocolViews->map(fn ($r) => ['protocol', $r->subject_slug]),
            ...$labRows->map(fn ($r) => ['lab', $r['slug']]),
            ...$quizRows->map(fn ($r) => ['quiz', $r['slug']]),
            ...$favorites->map(fn ($r) => [$r->subject_type, $r->subject_slug]),
            ...$ratings->map(fn ($r) => [$r->subject_type, $r->subject_slug]),
        ]);
        $title = fn (string $type, string $slug) => $describe["{$type}:{$slug}"]['title'] ?? $slug;

        return [
            'popularity' => [
                'lessons' => $lessonViews->map(fn ($r) => ['slug' => $r->subject_slug, 'title' => $title('lesson', $r->subject_slug), 'value' => (int) $r->n])->all(),
                'protocols' => $protocolViews->map(fn ($r) => ['slug' => $r->subject_slug, 'title' => $title('protocol', $r->subject_slug), 'value' => (int) $r->n])->all(),
            ],
            'labs' => $labRows->map(fn ($r) => [...$r, 'title' => $title('lab', $r['slug'])])->all(),
            'quizzes' => $quizRows->map(fn ($r) => [...$r, 'title' => $title('quiz', $r['slug'])])->all(),
            'favorites' => $favorites->map(fn ($r) => ['type' => $r->subject_type, 'slug' => $r->subject_slug, 'title' => $title($r->subject_type, $r->subject_slug), 'value' => (int) $r->n])->all(),
            'satisfaction' => $ratings->map(fn ($r) => ['type' => $r->subject_type, 'slug' => $r->subject_slug, 'title' => $title($r->subject_type, $r->subject_slug), 'useful' => (int) $r->useful, 'unclear' => (int) $r->unclear])->all(),
            'searches' => $topSearches->map(fn ($r) => ['query' => $r->subject_slug, 'value' => (int) $r->n])->all(),
            'empty_searches' => $emptySearches->map(fn ($r) => ['query' => $r->subject_slug, 'value' => (int) $r->n])->all(),
        ];
    }

    private function median(Collection $values): ?int
    {
        $sorted = $values->filter(fn ($v) => $v !== null)->map(fn ($v) => (int) $v)->sort()->values();
        $count = $sorted->count();
        if ($count === 0) {
            return null;
        }
        $middle = intdiv($count, 2);

        return $count % 2 ? $sorted[$middle] : (int) round(($sorted[$middle - 1] + $sorted[$middle]) / 2);
    }
}
