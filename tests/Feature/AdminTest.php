<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\LabSession;
use App\Models\Lesson;
use App\Models\Protocol;
use App\Models\ProtocolCategory;
use App\Models\ScenarioDefinition;
use App\Models\User;
use App\Services\Platform\Settings;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    public function test_toutes_les_pages_d_administration_s_affichent(): void
    {
        $protocol = Protocol::first();
        $lesson = Lesson::first();
        $scenario = ScenarioDefinition::first();
        foreach ([
            '/admin', '/admin/audience', '/admin/apprentissage', '/admin/utilisateurs', '/admin/utilisateurs/'.$this->admin->id,
            '/admin/cours', '/admin/chapitres/nouveau', '/admin/chapitres/'.$lesson->id, '/admin/protocoles', '/admin/protocoles/nouveau',
            '/admin/protocoles/'.$protocol->id, '/admin/glossaire', '/admin/glossaire/nouveau', '/admin/scenarios', '/admin/scenarios/nouveau',
            '/admin/scenarios/'.$scenario->id, '/admin/quiz', '/admin/quiz/nouveau', '/admin/quiz/1', '/admin/diagnostics', '/admin/diagnostics/nouveau',
            '/admin/diagnostics/1', '/admin/retours', '/admin/evaluations', '/admin/journal', '/admin/parametres',
            '/admin?periode=perso&du='.now()->subDays(10)->format('Y-m-d').'&au='.now()->format('Y-m-d'),
        ] as $url) {
            $response = $this->actingAs($this->admin)->get($url);
            $response->assertOk();
            $component = $response->viewData('page')['component'];
            $this->assertFileExists(resource_path("js/pages/{$component}.tsx"), "Page manquante pour {$url}");
        }
    }

    public function test_les_indicateurs_sont_calcules_a_partir_des_donnees(): void
    {
        $students = User::factory()->count(3)->create();
        $this->actingAs($students[0])->postJson('/api/labs/dns/sessions', ['total_steps' => 2]);
        $id = $this->postJson('/api/labs/arp/sessions', ['total_steps' => 2])->json('session.id');
        $this->patchJson("/api/lab-sessions/{$id}", ['current_step' => 1, 'steps_seen' => [0, 1]]);
        // Séance ancienne, hors période « aujourd'hui ».
        $old = new LabSession(['lab_type' => 'scenario', 'lab_slug' => 'tls', 'status' => 'in_progress', 'total_steps' => 3, 'started_at' => now()->subDays(20), 'last_activity_at' => now()->subDays(20)]);
        $old->user()->associate($students[1])->save();

        $this->actingAs($this->admin)->get('/admin?periode=aujourdhui')->assertInertia(fn (Assert $page) => $page
            ->where('overview.students_total', 3)
            ->where('overview.labs_started', 2)
            ->where('overview.labs_completed', 1)
            ->where('overview.completion_rate', 50)
            ->where('period.key', 'aujourdhui')
            ->has('series.labs_started', 1)
            ->etc());
        $this->get('/admin?periode=30j')->assertInertia(fn (Assert $page) => $page->where('overview.labs_started', 3)->has('series.labs_started', 30)->etc());

        $this->get('/admin/apprentissage?periode=30j')->assertInertia(fn (Assert $page) => $page->has('learning.labs', 3)->etc());
    }

    public function test_gestion_des_cours_et_chapitres_avec_journal(): void
    {
        $this->actingAs($this->admin)->post('/admin/cours', ['title' => 'Sécurité réseau', 'slug' => 'securite', 'description' => 'Pare-feu et VPN', 'level' => 'intermediaire', 'status_publication' => 'draft'])->assertSessionHasNoErrors();
        $course = Course::where('slug', 'securite')->firstOrFail();

        $this->post('/admin/chapitres', [
            'title' => 'Le pare-feu en action', 'slug' => 'pare-feu', 'course_id' => $course->id, 'objective' => 'Comprendre le filtrage.',
            'duration' => 12, 'kind' => 'scenario', 'scenario_key' => 'tcp-handshake', 'concepts' => ['nat'], 'protocols' => [Protocol::where('slug', 'tcp')->value('id')],
            'references' => "RFC 9293 — TCP | https://www.rfc-editor.org/rfc/rfc9293\nNote sans lien", 'status_publication' => 'draft', 'featured' => false,
        ])->assertSessionHasNoErrors();
        $lesson = Lesson::where('slug', 'pare-feu')->firstOrFail();
        $this->assertSame('/lecons/pare-feu', $lesson->href);
        $this->assertCount(2, $lesson->references);
        $this->assertNull($lesson->references[1]['url']);

        // Brouillon : invisible pour un visiteur, visible pour l'admin.
        $this->post('/deconnexion');
        $this->get('/lecons/pare-feu')->assertNotFound();
        $this->actingAs($this->admin)->get('/lecons/pare-feu')->assertOk()->assertInertia(fn (Assert $page) => $page->where('lesson.draft', true)->etc());

        $this->put("/admin/chapitres/{$lesson->id}", [...$lesson->only(['title', 'slug', 'course_id', 'objective', 'duration', 'kind', 'scenario_key']), 'status_publication' => 'published', 'concepts' => [], 'protocols' => []])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('admin_logs', ['action' => 'lesson.published', 'user_id' => $this->admin->id]);
        $this->assertDatabaseHas('admin_logs', ['action' => 'course.created']);
    }

    public function test_un_chapitre_utilise_ne_peut_pas_etre_supprime(): void
    {
        $student = User::factory()->create();
        $this->actingAs($student)->postJson('/api/labs/dns/sessions', ['total_steps' => 3]);
        $lesson = Lesson::where('slug', 'dns')->first();
        $this->actingAs($this->admin)->delete("/admin/chapitres/{$lesson->id}")->assertSessionHas('error');
        $this->assertDatabaseHas('lessons', ['id' => $lesson->id]);
    }

    public function test_une_fiche_complete_exige_toutes_ses_rubriques(): void
    {
        $base = [
            'slug' => 'nouveau-proto', 'acronym' => 'NP', 'name' => 'Nouveau protocole', 'protocol_category_id' => ProtocolCategory::first()->id,
            'status' => 'standard', 'completeness' => 'complete', 'summary' => 'Résumé', 'problem' => 'Problème', 'beginner' => 'Débutant', 'analogy' => 'Analogie',
            'references' => [['label' => 'RFC 0000', 'url' => null]], 'status_publication' => 'draft',
        ];
        $this->actingAs($this->admin)->post('/admin/protocoles', $base)->assertSessionHasErrors('completeness');
        $this->post('/admin/protocoles', [...$base, 'references' => []])->assertSessionHasErrors('references');
        $this->post('/admin/protocoles', [...$base, 'completeness' => 'essential', 'related' => [['protocol_id' => Protocol::where('slug', 'tcp')->value('id'), 'type' => 'uses']]])->assertSessionHasNoErrors();
        $created = Protocol::where('slug', 'nouveau-proto')->firstOrFail();
        // La relation inverse est créée sur la fiche TCP.
        $this->assertDatabaseHas('protocol_relationships', ['protocol_id' => Protocol::where('slug', 'tcp')->value('id'), 'related_protocol_id' => $created->id, 'type' => 'used-by']);
    }

    public function test_scenario_personnalise_valide_avant_publication(): void
    {
        $invalid = ['id' => 'x', 'title' => 'X', 'summary' => 'Y', 'assumptions' => [], 'viewBox' => ['w' => 800, 'h' => 400], 'nodes' => [], 'links' => [], 'packets' => (object) [], 'steps' => []];
        $this->actingAs($this->admin)->post('/admin/scenarios', ['key' => 'perso', 'title' => 'Perso', 'definition' => json_encode($invalid)])->assertSessionHasNoErrors();
        $scenario = ScenarioDefinition::where('key', 'perso')->firstOrFail();
        $this->post("/admin/scenarios/{$scenario->id}/publication", ['status' => 'published'])->assertSessionHas('error');
        $this->assertSame('draft', $scenario->fresh()->status_publication);

        $valid = [...$invalid,
            'nodes' => [['id' => 'a', 'kind' => 'laptop', 'label' => 'A', 'x' => 100, 'y' => 100, 'description' => 'Poste'], ['id' => 'b', 'kind' => 'server', 'label' => 'B', 'x' => 600, 'y' => 100, 'description' => 'Serveur']],
            'links' => [['from' => 'a', 'to' => 'b']],
            'steps' => [['id' => 's1', 'title' => 'Envoi', 'text' => ['1' => 'A parle à B.'], 'focus' => ['a', 'b'], 'packets' => [['id' => 'p', 'label' => 'Bonjour', 'tone' => 'request', 'path' => ['a', 'b']]]]],
        ];
        $this->put("/admin/scenarios/{$scenario->id}", ['key' => 'perso', 'title' => 'Perso', 'definition' => json_encode($valid)])->assertSessionHasNoErrors();
        $this->post("/admin/scenarios/{$scenario->id}/publication", ['status' => 'published'])->assertSessionHasNoErrors();
        $this->assertTrue($scenario->fresh()->isPublished());

        // Un paquet empruntant un lien inexistant est refusé une fois publié.
        $broken = $valid;
        $broken['steps'][0]['packets'][0]['path'] = ['b', 'c'];
        $this->put("/admin/scenarios/{$scenario->id}", ['key' => 'perso', 'title' => 'Perso', 'definition' => json_encode($broken)])->assertSessionHasErrors('definition');
    }

    public function test_un_scenario_integre_retire_bloque_le_tp(): void
    {
        $scenario = ScenarioDefinition::where('key', 'dns')->firstOrFail();
        $this->actingAs($this->admin)->post("/admin/scenarios/{$scenario->id}/publication", ['status' => 'draft']);
        $student = User::factory()->create();
        $this->actingAs($student)->get('/laboratoire/dns')->assertNotFound();
        $this->get('/laboratoire')->assertInertia(fn (Assert $page) => $page->where('labs', fn ($labs) => collect($labs)->doesntContain('slug', 'dns'))->etc());
    }

    public function test_quiz_et_diagnostic_valides_par_le_serveur(): void
    {
        $this->actingAs($this->admin)->post('/admin/quiz', [
            'slug' => 'quiz-test', 'title' => 'Test', 'status_publication' => 'published',
            'questions' => [['type' => 'single', 'prompt' => 'Q ?', 'explanation' => 'Parce que.', 'options' => ['A', 'B'], 'answer' => 5]],
        ])->assertSessionHasErrors('questions.0.answer');

        $this->post('/admin/diagnostics', [
            'slug' => 'diag-test', 'title' => 'Diag', 'difficulty' => 'facile', 'summary' => 'R', 'symptoms' => ['S'], 'observations' => [],
            'hints' => ['I'], 'choices' => ['A', 'B'], 'answer' => 4, 'explanation' => 'E', 'status_publication' => 'draft',
        ])->assertSessionHasErrors('answer');
    }

    public function test_gestion_des_utilisateurs(): void
    {
        $student = User::factory()->create(['email' => 'eleve@example.com']);
        $this->actingAs($this->admin)->post("/admin/utilisateurs/{$student->id}/suspendre", ['reason' => 'Abus répété du formulaire'])->assertSessionHasNoErrors();
        $this->assertTrue($student->fresh()->isSuspended());
        $this->post("/admin/utilisateurs/{$student->id}/reactiver");
        $this->assertFalse($student->fresh()->isSuspended());

        $csv = $this->get('/admin/utilisateurs/export')->assertOk()->streamedContent();
        $this->assertStringContainsString('eleve@example.com', $csv);
        $this->assertStringNotContainsString($student->password, $csv);
        $this->assertDatabaseHas('admin_logs', ['action' => 'export.users']);

        $this->get('/admin/utilisateurs?q=eleve')->assertInertia(fn (Assert $page) => $page->where('users.total', 1)->etc());

        $this->delete("/admin/utilisateurs/{$student->id}", ['confirmation' => 'faux'])->assertSessionHasErrors('confirmation');
        $this->delete("/admin/utilisateurs/{$student->id}", ['confirmation' => 'eleve@example.com'])->assertRedirect('/admin/utilisateurs');
        $this->assertDatabaseMissing('users', ['id' => $student->id]);
        $this->assertDatabaseHas('admin_logs', ['action' => 'user.deleted', 'subject_label' => 'eleve@example.com']);
    }

    public function test_parametres_journalises_sans_secrets(): void
    {
        $this->actingAs($this->admin)->put('/admin/parametres', ['values' => ['analytics.presence_window' => 10, 'accounts.registration_open' => false, 'unknown.key' => 'x']])->assertSessionHasNoErrors();
        $settings = app(Settings::class);
        $settings->flush();
        $this->assertSame(10, $settings->get('analytics.presence_window'));
        $this->assertFalse($settings->get('accounts.registration_open'));
        $this->assertDatabaseMissing('settings', ['key' => 'unknown.key']);
        $this->assertDatabaseHas('admin_logs', ['action' => 'settings.updated']);

        $this->put('/admin/parametres', ['values' => ['analytics.retention_days' => 5000]])->assertSessionHasErrors();
        $page = $this->get('/admin/parametres')->viewData('page');
        $this->assertStringNotContainsString('api_key', json_encode($page['props']));
    }

    public function test_retours_traites_par_l_administration(): void
    {
        $student = User::factory()->create();
        $this->actingAs($student)->postJson('/api/retours', ['category' => 'quiz', 'message' => 'Question 2 ambiguë.']);
        $report = \App\Models\FeedbackReport::firstOrFail();
        $this->actingAs($this->admin)->put("/admin/retours/{$report->id}", ['status' => 'resolved', 'priority' => 'high', 'admin_note' => 'Corrigé'])->assertSessionHasNoErrors();
        $this->assertNotNull($report->fresh()->resolved_at);
        $this->assertSame($this->admin->id, $report->fresh()->handled_by);
    }
}
