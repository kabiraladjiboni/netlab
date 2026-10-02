<?php

namespace Tests\Feature;

use App\Models\AnalyticsEvent;
use App\Models\User;
use App\Models\VisitorSession;
use App\Services\Analytics\GeoIp;
use App\Services\Analytics\Tracker;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    private function importGeo(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'geo');
        file_put_contents($file, "41.0.0.0,41.255.255.255,BJ\n203.0.113.0,203.0.113.255,FR\n2001:db8::,2001:db8::ffff,SN\nligne invalide\n");
        $this->artisan('netlab:geoip-import', ['file' => $file])->assertSuccessful();
        unlink($file);
    }

    public function test_aucune_adresse_ip_n_est_stockee(): void
    {
        foreach (['analytics_events', 'visitor_sessions', 'feedback_reports', 'admin_logs', 'lab_sessions'] as $table) {
            foreach (Schema::getColumnListing($table) as $column) {
                $this->assertStringNotContainsString('ip', strtolower(str_replace(['description', 'subject_type'], '', $column)), "{$table}.{$column}");
            }
        }
    }

    public function test_sans_consentement_seul_un_compteur_anonyme_est_enregistre(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '41.1.2.3'])->get('/protocoles')->assertOk();
        $event = AnalyticsEvent::where('type', 'page_view')->latest('id')->firstOrFail();
        $this->assertNull($event->visitor_hash);
        $this->assertNull($event->session_hash);
        $this->assertNull($event->country);
        $this->assertSame(0, VisitorSession::count());
    }

    public function test_avec_consentement_pays_estime_et_identifiants_haches(): void
    {
        $this->importGeo();
        $this->withCookie(Tracker::CONSENT_COOKIE, 'granted')->withServerVariables(['REMOTE_ADDR' => '41.1.2.3'])->get('/protocoles')->assertOk();
        $session = VisitorSession::firstOrFail();
        $this->assertSame('BJ', $session->country);
        $this->assertSame(64, strlen($session->visitor_hash));
        $this->assertStringNotContainsString('41.1.2.3', json_encode(DB::table('visitor_sessions')->get()));
        $this->assertStringNotContainsString('41.1.2.3', json_encode(DB::table('analytics_events')->get()));
        $this->assertSame('BJ', AnalyticsEvent::where('type', 'page_view')->latest('id')->value('country'));
    }

    public function test_choix_du_consentement(): void
    {
        $this->postJson('/api/consentement', ['choice' => 'denied'])->assertOk()->assertCookie(Tracker::CONSENT_COOKIE, 'denied');
        $this->postJson('/api/consentement', ['choice' => 'peut-etre'])->assertUnprocessable();
    }

    public function test_base_geographique_ipv4_et_ipv6(): void
    {
        $this->importGeo();
        $geo = app(GeoIp::class);
        $this->assertSame('BJ', $geo->lookup('41.200.0.1'));
        $this->assertSame('SN', $geo->lookup('2001:db8::42'));
        $this->assertNull($geo->lookup('8.8.8.8'));
        $this->assertNull($geo->lookup('pas-une-ip'));
    }

    public function test_presence_selon_la_fenetre_d_activite(): void
    {
        VisitorSession::create(['session_hash' => str_repeat('a', 64), 'first_seen_at' => now()->subMinutes(30), 'last_seen_at' => now()->subMinute(), 'signals' => 3]);
        VisitorSession::create(['session_hash' => str_repeat('b', 64), 'first_seen_at' => now()->subHour(), 'last_seen_at' => now()->subMinutes(20), 'signals' => 5]);
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin/audience')->assertInertia(fn (Assert $page) => $page
            ->where('presence.window_minutes', 5)
            ->where('presence.active_sessions', 1) // l'administration n'est pas comptée ; la session d'il y a 20 min est hors fenêtre
            ->where('geography.available', false)
            ->etc());
    }

    public function test_le_battement_de_presence_ne_suit_que_les_sessions_autorisees(): void
    {
        $this->postJson('/api/presence')->assertNoContent();
        $this->assertSame(0, VisitorSession::count());
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/presence')->assertNoContent();
        $this->assertSame(1, VisitorSession::count());
        $this->assertSame($user->id, VisitorSession::first()->user_id);
        $this->assertNull(VisitorSession::first()->country, 'Sans consentement, pas de pays même connecté.');
    }

    public function test_purge_selon_la_duree_de_conservation(): void
    {
        AnalyticsEvent::create(['type' => 'page_view', 'occurred_at' => now()->subDays(400)]);
        AnalyticsEvent::create(['type' => 'page_view', 'occurred_at' => now()->subDays(2)]);
        VisitorSession::create(['session_hash' => str_repeat('c', 64), 'first_seen_at' => now()->subDays(400), 'last_seen_at' => now()->subDays(400)]);
        $this->artisan('netlab:analytics-purge')->assertSuccessful();
        $this->assertSame(1, AnalyticsEvent::count());
        $this->assertSame(0, VisitorSession::count());
    }

    public function test_recherche_journalisee_sans_donnees_personnelles(): void
    {
        $this->getJson('/api/recherche?q=rou');
        $this->getJson('/api/recherche?q=routage');
        $searches = AnalyticsEvent::where('type', 'search')->get();
        $this->assertCount(1, $searches, 'Seule la requête finale est conservée.');
        $this->assertSame('routage', $searches[0]->subject_slug);

        $this->getJson('/api/recherche?q=jean.dupont@example.com');
        $this->assertSame('[masqué]', AnalyticsEvent::where('type', 'search')->latest('id')->value('subject_slug'));
    }

    public function test_les_consultations_sont_dedupliquees(): void
    {
        $this->get('/lecons/dns');
        $this->get('/lecons/dns');
        $this->assertSame(1, AnalyticsEvent::where('type', 'lesson_view')->where('subject_slug', 'dns')->count());
    }
}
