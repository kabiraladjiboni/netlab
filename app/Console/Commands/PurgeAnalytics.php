<?php

namespace App\Console\Commands;

use App\Services\Platform\Settings;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** Applique la durée de conservation des données de mesure (planifiée chaque jour). */
class PurgeAnalytics extends Command
{
    protected $signature = 'netlab:analytics-purge';

    protected $description = 'Supprime les événements analytiques et sessions de mesure plus anciens que la durée de conservation.';

    public function handle(Settings $settings): int
    {
        $days = (int) $settings->get('analytics.retention_days');
        $limit = now()->subDays($days);
        $events = DB::table('analytics_events')->where('occurred_at', '<', $limit)->delete();
        $sessions = DB::table('visitor_sessions')->where('last_seen_at', '<', $limit)->delete();
        $this->info("Conservation : {$days} jours. Supprimés : {$events} événement(s), {$sessions} session(s).");

        return self::SUCCESS;
    }
}
