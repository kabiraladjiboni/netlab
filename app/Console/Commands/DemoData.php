<?php

namespace App\Console\Commands;

use App\Models\AnalyticsEvent;
use App\Models\ContentRating;
use App\Models\Favorite;
use App\Models\FeedbackReport;
use App\Models\LabSession;
use App\Models\Lesson;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Models\VisitorSession;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Données de DÉMONSTRATION, uniquement en développement (APP_ENV=local ou testing).
 * Tous les comptes créés utilisent le domaine @demo.netlab.test et l'administration
 * affiche un avertissement tant qu'ils existent. `--remove` les supprime.
 */
class DemoData extends Command
{
    protected $signature = 'netlab:demo {--students=40} {--remove : Supprimer les données de démonstration}';

    protected $description = 'Génère des données fictives pour tester l’administration (développement uniquement).';

    public function handle(): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->error('Refusé : les données de démonstration ne sont autorisées qu’en environnement local.');

            return self::FAILURE;
        }

        $demo = User::where('email', 'like', '%@demo.netlab.test');
        if ($this->option('remove')) {
            $ids = $demo->pluck('id');
            AnalyticsEvent::whereIn('user_id', $ids)->orWhere('meta->demo', true)->delete();
            VisitorSession::where('session_hash', 'like', 'demo%')->delete();
            User::whereIn('id', $ids)->delete();
            $this->info('Données de démonstration supprimées.');

            return self::SUCCESS;
        }

        mt_srand(42);
        $labs = Lesson::where('kind', 'scenario')->pluck('slug')->all();
        $countries = ['BJ' => 30, 'CI' => 14, 'SN' => 12, 'FR' => 10, 'TG' => 9, 'CM' => 8, 'BF' => 6, 'CA' => 4, 'MA' => 4, 'BE' => 3];
        $pick = function () use ($countries) {
            $roll = mt_rand(1, array_sum($countries));
            foreach ($countries as $code => $weight) {
                if (($roll -= $weight) <= 0) {
                    return $code;
                }
            }

            return 'BJ';
        };
        $names = ['Awa', 'Koffi', 'Mariam', 'Yao', 'Fatou', 'Ibrahim', 'Aïcha', 'Serge', 'Nadia', 'Rodrigue', 'Grâce', 'Moussa', 'Esther', 'Junior', 'Clarisse'];

        for ($i = 1; $i <= (int) $this->option('students'); $i++) {
            $created = now()->subDays(mt_rand(0, 60))->subMinutes(mt_rand(0, 1400));
            $user = User::create(['name' => $names[array_rand($names)].' '.chr(64 + $i % 26).'.', 'email' => "etudiant{$i}@demo.netlab.test", 'password' => Str::random(32), 'country' => mt_rand(0, 2) ? $pick() : null]);
            $user->forceFill(['created_at' => $created, 'email_verified_at' => mt_rand(0, 5) ? $created : null, 'terms_accepted_at' => $created, 'last_active_at' => now()->subMinutes(mt_rand(1, 60 * 24 * 10))])->save();

            foreach (array_slice($labs, 0, mt_rand(0, count($labs))) as $slug) {
                $total = mt_rand(8, 16);
                $seen = mt_rand(1, $total);
                $started = $created->copy()->addHours(mt_rand(1, 400));
                if ($started->isFuture()) {
                    $started = now()->subHours(mt_rand(1, 48));
                }
                $done = $seen === $total || mt_rand(0, 2) === 0;
                $session = new LabSession([
                    'lab_type' => 'scenario', 'lab_slug' => $slug, 'status' => $done ? 'completed' : 'in_progress',
                    'current_step' => $done ? $total - 1 : $seen - 1, 'total_steps' => $total, 'steps_seen' => range(0, $done ? $total - 1 : $seen - 1),
                    'active_seconds' => mt_rand(120, 1500), 'started_at' => $started, 'last_activity_at' => $started->copy()->addMinutes(mt_rand(3, 40)),
                    'completed_at' => $done ? $started->copy()->addMinutes(mt_rand(5, 40)) : null,
                ]);
                $session->user()->associate($user)->save();
                AnalyticsEvent::create(['type' => 'lab_start', 'occurred_at' => $started, 'user_id' => $user->id, 'subject_type' => 'lab', 'subject_slug' => $slug]);
                AnalyticsEvent::create(['type' => 'lesson_view', 'occurred_at' => $started->copy()->subMinutes(2), 'user_id' => $user->id, 'subject_type' => 'lesson', 'subject_slug' => $slug]);
                if ($done && mt_rand(0, 1)) {
                    $user->quizAttempts()->create(['quiz_slug' => 'quiz-'.$slug, 'score' => $s = mt_rand(2, 6), 'total' => 6, 'created_at' => $started->copy()->addMinutes(45)]);
                }
                if (mt_rand(0, 3) === 0) {
                    $user->ratings()->firstOrCreate(['subject_type' => 'lesson', 'subject_slug' => $slug], ['value' => mt_rand(0, 4) ? 'useful' : 'unclear']);
                }
                if (mt_rand(0, 5) === 0) {
                    $user->favorites()->firstOrCreate(['subject_type' => 'lab', 'subject_slug' => $slug], ['created_at' => $started]);
                }
            }
        }

        // Sessions de visite (consenties) et pages vues sur 30 jours.
        for ($d = 0; $d < 30; $d++) {
            $visits = mt_rand(15, 45);
            for ($v = 0; $v < $visits; $v++) {
                $at = now()->subDays($d)->setTime(mt_rand(7, 23), mt_rand(0, 59));
                $hash = 'demo'.Str::random(60);
                VisitorSession::create(['session_hash' => $hash, 'visitor_hash' => hash('sha256', $hash), 'country' => mt_rand(0, 9) ? $pick() : null, 'signals' => $n = mt_rand(1, 14), 'first_seen_at' => $at, 'last_seen_at' => $at->copy()->addMinutes($n * 2)]);
                for ($p = 0; $p < $n; $p++) {
                    AnalyticsEvent::create(['type' => 'page_view', 'occurred_at' => $at->copy()->addMinutes($p * 2), 'session_hash' => $hash, 'visitor_hash' => hash('sha256', $hash), 'meta' => ['demo' => true]]);
                }
            }
        }
        foreach (['dhcp' => 4, 'vlan' => 2, 'ospf' => 5, 'ipv6' => 3, 'wifi 7' => 2, 'bgp' => 3] as $q => $count) {
            for ($i = 0; $i < $count; $i++) {
                AnalyticsEvent::create(['type' => 'search', 'occurred_at' => now()->subDays(mt_rand(0, 20)), 'subject_type' => 'query', 'subject_slug' => $q, 'value' => in_array($q, ['wifi 7', 'ospf'], true) ? 0 : 3, 'meta' => ['demo' => true]]);
            }
        }
        // Quelques sessions actives « maintenant ».
        for ($i = 0; $i < 6; $i++) {
            VisitorSession::create(['session_hash' => 'demo'.Str::random(60), 'country' => $pick(), 'signals' => 4, 'first_seen_at' => now()->subMinutes(12), 'last_seen_at' => now()->subSeconds(mt_rand(10, 200))]);
        }
        $first = User::where('email', 'like', '%@demo.netlab.test')->first();
        FeedbackReport::create(['user_id' => $first?->id, 'category' => 'explication', 'subject_type' => 'lesson', 'subject_slug' => 'nat-pat', 'message' => '(Démo) L’étape sur la redirection de port n’est pas claire.', 'status' => 'new', 'priority' => 'normal']);

        $this->info('Données de démonstration créées (comptes @demo.netlab.test). Pour les retirer : php artisan netlab:demo --remove');

        return self::SUCCESS;
    }
}
