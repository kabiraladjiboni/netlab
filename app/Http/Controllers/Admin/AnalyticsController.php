<?php

namespace App\Http\Controllers\Admin;

use App\Services\Analytics\Metrics;
use App\Services\Analytics\Period;
use App\Services\Platform\Settings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AnalyticsController extends AdminController
{
    public function audience(Request $request, Metrics $metrics, Settings $settings): Response
    {
        $period = Period::fromRequest($request);

        return Inertia::render('admin/audience', [
            'period' => $period->toArray(),
            'presence' => $metrics->presence(),
            'overview' => $metrics->overview($period),
            'series' => $metrics->series($period),
            'hourly' => $metrics->hourly($period),
            'geography' => $metrics->geography($period),
            'retentionDays' => (int) $settings->get('analytics.retention_days'),
            'geoHeader' => (bool) config('netlab.geo.header'),
        ]);
    }

    public function learning(Request $request, Metrics $metrics): Response
    {
        $period = Period::fromRequest($request);

        return Inertia::render('admin/learning', [
            'period' => $period->toArray(),
            'learning' => $metrics->learning($period),
        ]);
    }

    /** Exports agrégés (aucune donnée personnelle). Chaque export est journalisé. */
    public function export(Request $request, string $report, Metrics $metrics): StreamedResponse
    {
        $period = Period::fromRequest($request);
        $rows = match ($report) {
            'indicateurs' => collect($metrics->overview($period))->map(fn ($value, $key) => [$key, $value])->values()->all(),
            'contenus' => collect($metrics->learning($period)['labs'])->map(fn ($r) => [$r['title'], $r['started'], $r['completed'], $r['rate'], $r['abandoned']])->all(),
            'pays' => collect($metrics->geography($period)['countries'])->map(fn ($r) => [$r['code'], $r['name'], $r['sessions'], $r['students'], $r['share']])->all(),
        };
        $header = match ($report) {
            'indicateurs' => ['indicateur', 'valeur'],
            'contenus' => ['tp', 'commencés', 'terminés', 'taux_completion_%', 'abandons'],
            'pays' => ['code', 'pays_estime', 'sessions', 'etudiants', 'part_%'],
        };
        $this->log($request, 'export.analytics', 'report', $report, ['du' => $period->from->format('Y-m-d'), 'au' => $period->to->format('Y-m-d')]);

        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            \App\Support\Security\Csv::put($out, $header);
            foreach ($rows as $row) {
                \App\Support\Security\Csv::put($out, $row);
            }
            fclose($out);
        }, "aboro-labs-{$report}-{$period->from->format('Ymd')}-{$period->to->format('Ymd')}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
