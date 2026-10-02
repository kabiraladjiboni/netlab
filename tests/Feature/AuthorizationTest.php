<?php

namespace Tests\Feature;

use App\Models\LabSession;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    public function test_un_visiteur_ne_peut_pas_manipuler_un_tp(): void
    {
        $this->get('/laboratoire/dns')->assertRedirect('/connexion');
        $this->get('/app')->assertRedirect('/connexion');
        $this->postJson('/api/labs/dns/sessions', ['total_steps' => 5])->assertUnauthorized();
        $this->postJson('/api/diagnostics/passerelle-inaccessible/reponse', ['choice' => 0])->assertUnauthorized();
        // Mais les cours restent publics.
        $this->get('/lecons/dns')->assertOk();
        $this->get('/protocoles/dns')->assertOk();
    }

    public function test_un_compte_non_verifie_doit_confirmer_son_adresse(): void
    {
        $user = User::factory()->unverified()->create();
        $this->actingAs($user)->get('/laboratoire/dns')->assertRedirect('/email/verification');
        $this->postJson('/api/labs/dns/sessions', ['total_steps' => 5])->assertForbidden();
        $this->get('/app')->assertOk();
    }

    public function test_un_etudiant_n_accede_a_aucune_route_d_administration(): void
    {
        $student = User::factory()->create();
        $routes = collect(Route::getRoutes())->filter(fn ($route) => str_starts_with($route->uri(), 'admin') && in_array('GET', $route->methods(), true));
        $this->assertGreaterThan(15, $routes->count());
        foreach ($routes as $route) {
            $uri = preg_replace('/\{[^}]+\}/', '1', $route->uri());
            $uri = str_replace('export/1', 'export/indicateurs', $uri);
            $this->actingAs($student)->get('/'.$uri)->assertForbidden();
        }
        $this->actingAs($student)->post('/admin/cours', ['title' => 'x'])->assertForbidden();
        $this->actingAs($student)->delete('/admin/utilisateurs/'.$student->id)->assertForbidden();
    }

    public function test_un_etudiant_ne_peut_pas_modifier_la_seance_d_un_autre(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $id = $this->actingAs($alice)->postJson('/api/labs/dns/sessions', ['total_steps' => 4])->json('session.id');

        $this->actingAs($bob)->patchJson("/api/lab-sessions/{$id}", ['current_step' => 3, 'steps_seen' => [0, 1, 2, 3]])->assertNotFound();
        $this->assertSame('in_progress', LabSession::find($id)->status);
        // Les résultats d'un TP sont toujours ceux de l'utilisateur connecté.
        $this->actingAs($bob)->get('/laboratoire/dns/resultats')->assertInertia(fn ($page) => $page->has('sessions', 0)->etc());
    }

    public function test_le_role_ne_peut_pas_etre_modifie_par_le_profil(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->patch('/app/mon-profil', ['name' => 'Nouveau nom', 'email' => $user->email, 'role' => 'admin', 'is_admin' => true])->assertSessionHasNoErrors();
        $this->assertSame('student', $user->fresh()->role);
        $this->assertSame('Nouveau nom', $user->fresh()->name);
        $this->actingAs($user)->get('/admin')->assertForbidden();
    }

    public function test_changement_de_role_protege(): void
    {
        $admin = User::factory()->admin()->create();
        $student = User::factory()->create();

        $this->actingAs($admin)->post("/admin/utilisateurs/{$student->id}/role", ['role' => 'admin', 'password' => 'mauvais'])->assertSessionHasErrors('password');
        $this->assertSame('student', $student->fresh()->role);

        $this->actingAs($admin)->post("/admin/utilisateurs/{$student->id}/role", ['role' => 'admin', 'password' => 'password'])->assertSessionHasNoErrors();
        $this->assertSame('admin', $student->fresh()->role);
        $this->assertDatabaseHas('admin_logs', ['action' => 'user.role_changed', 'subject_label' => $student->email]);

        // Personne ne peut modifier son propre rôle.
        $this->actingAs($admin)->post("/admin/utilisateurs/{$admin->id}/role", ['role' => 'student', 'password' => 'password'])->assertStatus(422);
    }
}
