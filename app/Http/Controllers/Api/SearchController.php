<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Services\Analytics\Tracker;
use App\Services\Search\SearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request, SearchService $search): JsonResponse
    {
        $validated = $request->validate(['q' => ['required', 'string', 'max:80']]);
        $results = $search->search($validated['q']);
        $this->log($request, $validated['q'], $results);

        return response()->json(['results' => $results]);
    }

    /**
     * La recherche est interrogée à chaque frappe : on ne garde que la requête
     * finale (« ro », « rou », « routage » → un seul événement « routage »).
     */
    private function log(Request $request, string $query, array $results): void
    {
        $clean = Tracker::sanitizeQuery($query);
        if (mb_strlen($clean) < 2 || ! $request->hasSession()) {
            return;
        }
        $count = count($results);
        $last = $request->session()->get('analytics.search');
        if (is_array($last) && now()->timestamp - $last['at'] < 20 && (str_starts_with($clean, $last['q']) || str_starts_with($last['q'], $clean))) {
            AnalyticsEvent::query()->whereKey($last['id'])->update(['subject_slug' => $clean, 'value' => $count, 'occurred_at' => now()]);
            $request->session()->put('analytics.search', ['id' => $last['id'], 'q' => $clean, 'at' => now()->timestamp]);

            return;
        }
        $event = app(Tracker::class)->record($request, 'search', 'query', $clean, $count);
        $request->session()->put('analytics.search', ['id' => $event->id, 'q' => $clean, 'at' => now()->timestamp]);
    }
}
