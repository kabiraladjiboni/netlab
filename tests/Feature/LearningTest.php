<?php

namespace Tests\Feature;

use App\Models\AnalyticsEvent;
use App\Models\Diagnostic;
use App\Models\LabSession;
use App\Models\Quiz;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LearningTest extends TestCase
{
    public function test_une_seance_de_tp_est_enregistree_et_reprise(): void
    {
        $user = User::factory()->create();
        $first = $this->actingAs($user)->postJson('/api/labs/dns/sessions', ['variant' => null, 'total_steps' => 4])->assertOk()->json('session');
        $this->assertSame('in_progress', $first['status']);
        $this->patchJson("/api/lab-sessions/{$first['id']}", ['current_step' => 2, 'steps_seen' => [0, 1, 2], 'active_delta' => 30])->assertOk()->assertJsonPath('just_completed', false);

        // Reprise : même séance, étape enregistrée.
        $again = $this->postJson('/api/labs/dns/sessions', ['variant' => null, 'total_steps' => 4])->json('session');
        $this->assertSame($first['id'], $again['id']);
        $this->assertSame(2, $again['current_step']);
        $this->assertSame(1, AnalyticsEvent::where('type', 'lab_start')->count(), 'Une reprise ne compte pas comme un nouveau TP.');
    }

    public function test_un_tp_n_est_termine_que_si_toutes_les_etapes_sont_vues(): void
    {
        $user = User::factory()->create();
        $id = $this->actingAs($user)->postJson('/api/labs/dns/sessions', ['total_steps' => 4])->json('session.id');
        // Sauter directement à la dernière étape ne suffit pas.
        $this->patchJson("/api/lab-sessions/{$id}", ['current_step' => 3, 'steps_seen' => [3]])->assertJsonPath('session.status', 'in_progress');
        $this->patchJson("/api/lab-sessions/{$id}", ['current_step' => 3, 'steps_seen' => [1, 2, 99]])->assertJsonPath('just_completed', true);
        $this->assertSame('completed', LabSession::find($id)->status);
        $this->assertSame([0, 1, 2, 3], LabSession::find($id)->steps_seen, 'Les étapes hors limites sont ignorées.');
        $this->assertSame(1, AnalyticsEvent::where('type', 'lab_complete')->count());
        // Un temps actif aberrant est plafonné.
        $this->patchJson("/api/lab-sessions/{$id}", ['current_step' => 3, 'steps_seen' => [3], 'active_delta' => 3600]);
        $this->assertLessThanOrEqual(120, LabSession::find($id)->active_seconds);
    }

    public function test_le_score_du_quiz_est_recalcule_par_le_serveur(): void
    {
        $user = User::factory()->create();
        $quiz = Quiz::where('slug', 'quiz-osi')->firstOrFail();
        $correct = [];
        foreach ($quiz->questions as $question) {
            $correct[$question->id] = match ($question->type) {
                'single', 'multiple' => $question->payload['answer'],
                'order' => $question->payload['items'],
                'match' => collect($question->payload['pairs'])->mapWithKeys(fn ($p) => [$p['left'] => $p['right']])->all(),
            };
        }
        $total = $quiz->questions->count();
        $this->actingAs($user)->postJson('/api/quiz-attempts', ['quiz' => 'quiz-osi', 'answers' => $correct, 'score' => 0])->assertOk()->assertJsonPath('attempt.score', $total);
        $this->postJson('/api/quiz-attempts', ['quiz' => 'quiz-osi', 'answers' => [], 'score' => $total])->assertJsonPath('attempt.score', 0);
        $this->assertSame(2, $user->quizAttempts()->count());
    }

    public function test_le_quiz_genere_d_une_fiche_est_enregistrable(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/quiz-attempts', ['quiz' => 'protocole-dccp', 'answers' => []])->assertOk()->assertJsonPath('attempt.score', 0);
    }

    public function test_le_diagnostic_ne_revele_la_reponse_qu_au_bon_moment(): void
    {
        $diagnostic = Diagnostic::where('slug', 'passerelle-inaccessible')->firstOrFail();
        // Visiteur : aperçu sans choix, sans indice ni réponse.
        $this->get('/diagnostic/passerelle-inaccessible')->assertInertia(fn (Assert $page) => $page
            ->where('access', 'guest')->where('diagnostic.choices', [])->missing('diagnostic.answer')->missing('diagnostic.explanation')->etc());

        $user = User::factory()->create();
        $this->actingAs($user)->get('/diagnostic/passerelle-inaccessible')->assertInertia(fn (Assert $page) => $page
            ->has('diagnostic.choices', count($diagnostic->choices))->missing('diagnostic.answer')->missing('diagnostic.hints')->etc());

        $this->postJson('/api/diagnostics/passerelle-inaccessible/indice')->assertJsonCount(1, 'hints');
        $wrong = ($diagnostic->answer + 1) % count($diagnostic->choices);
        $this->postJson('/api/diagnostics/passerelle-inaccessible/reponse', ['choice' => $wrong])->assertJsonPath('correct', false)->assertJsonPath('answer', null);
        $other = ($diagnostic->answer + 2) % count($diagnostic->choices);
        $this->postJson('/api/diagnostics/passerelle-inaccessible/reponse', ['choice' => $other])->assertJsonPath('answer', $diagnostic->answer);
        $this->postJson('/api/diagnostics/passerelle-inaccessible/reponse', ['choice' => $diagnostic->answer])->assertJsonPath('correct', true);

        $session = $user->labSessions()->where('lab_type', 'diagnostic')->first();
        $this->assertSame('completed', $session->status);
        $this->assertSame(3, $session->attempts);
        $this->assertSame(1, $session->hints_used);
    }

    public function test_favoris_et_evaluations(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/favoris', ['type' => 'protocol', 'slug' => 'dns'])->assertJsonPath('favorite', true);
        $this->postJson('/api/favoris', ['type' => 'protocol', 'slug' => 'inexistant'])->assertNotFound();
        $this->get('/app/mes-favoris')->assertInertia(fn (Assert $page) => $page->has('favorites', 1)->where('favorites.0.slug', 'dns')->etc());
        $this->postJson('/api/favoris', ['type' => 'protocol', 'slug' => 'dns'])->assertJsonPath('favorite', false);

        // Cliquer plusieurs fois ne crée qu'une évaluation, modifiable.
        $this->putJson('/api/evaluations', ['type' => 'lesson', 'slug' => 'dns', 'value' => 'useful'])->assertOk();
        $this->putJson('/api/evaluations', ['type' => 'lesson', 'slug' => 'dns', 'value' => 'useful'])->assertOk();
        $this->putJson('/api/evaluations', ['type' => 'lesson', 'slug' => 'dns', 'value' => 'unclear', 'comment' => 'L’étape 3 va trop vite.'])->assertOk();
        $this->assertDatabaseCount('content_ratings', 1);
        $this->assertDatabaseHas('content_ratings', ['value' => 'unclear', 'comment_status' => 'pending']);
    }

    public function test_signalement_d_un_probleme(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/retours', ['category' => 'erreur', 'subject_type' => 'protocol', 'subject_slug' => 'dns', 'page_url' => '/protocoles/dns', 'message' => 'Le port indiqué me semble faux.'])->assertCreated();
        $this->postJson('/api/retours', ['category' => 'erreur', 'page_url' => 'https://ailleurs.example', 'message' => 'Un autre message.'])->assertCreated();
        $this->assertDatabaseHas('feedback_reports', ['status' => 'new', 'subject_slug' => 'dns']);
        $this->assertDatabaseHas('feedback_reports', ['message' => 'Un autre message.', 'page_url' => null]);
    }

    public function test_espace_etudiant_et_donnees_personnelles(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $other->quizAttempts()->create(['quiz_slug' => 'quiz-osi', 'score' => 3, 'total' => 5, 'created_at' => now()]);
        $user->quizAttempts()->create(['quiz_slug' => 'quiz-osi', 'score' => 4, 'total' => 5, 'created_at' => now()]);

        foreach (['/app', '/app/ma-progression', '/app/mes-favoris', '/app/mes-resultats', '/app/mon-historique', '/app/mon-profil', '/app/parametres'] as $url) {
            $this->actingAs($user)->get($url)->assertOk();
        }
        $this->get('/app/mes-resultats')->assertInertia(fn (Assert $page) => $page->has('attempts', 1)->where('attempts.0.score', 4)->etc());

        $export = $this->get('/app/parametres/export')->assertOk()->json();
        $this->assertSame($user->email, $export['compte']['email']);
        $this->assertCount(1, $export['quiz']);
        $this->assertArrayNotHasKey('password', $export['compte']);

        $this->delete('/app/parametres/compte', ['password' => 'password', 'confirmation' => 'SUPPRIMER'])->assertRedirect('/');
        $this->assertGuest();
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('quiz_attempts', ['user_id' => $user->id]);
        $this->assertDatabaseHas('quiz_attempts', ['user_id' => $other->id]);
    }

    public function test_tableau_de_bord_vide_et_recommandations(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/app')->assertInertia(fn (Assert $page) => $page
            ->component('app/dashboard', false)
            ->where('resume', null)
            ->where('stats.labs_started', 0)
            ->where('recommendations.0.href', '/laboratoire/acces-internet')
            ->etc());

        // Après un premier TP, la recommandation passe au suivant (requête avec jointure).
        $this->postJson('/api/labs/acces-internet/sessions', ['total_steps' => 3]);
        $this->get('/app')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('recommendations.0.href', '/laboratoire/nat-pat')
            ->where('resume.lab_slug', 'acces-internet')
            ->etc());
    }

    public function test_rejouer_un_tp_termine_ne_cree_pas_de_nouvelle_seance(): void
    {
        $user = User::factory()->create();
        $id = $this->actingAs($user)->postJson('/api/labs/dns/sessions', ['total_steps' => 2])->json('session.id');
        $this->patchJson("/api/lab-sessions/{$id}", ['current_step' => 1, 'steps_seen' => [0, 1]]);
        $again = $this->postJson('/api/labs/dns/sessions', ['total_steps' => 2])->json('session');
        $this->assertSame($id, $again['id']);
        $this->assertSame('completed', $again['status']);
        $this->assertSame(1, AnalyticsEvent::where('type', 'lab_start')->count());
    }
}
