<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordFr;
use App\Notifications\VerifyEmailFr;
use App\Services\Platform\Settings;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthTest extends TestCase
{
    private function registration(array $overrides = []): array
    {
        return [
            'name' => 'Awa Étudiante',
            'email' => 'awa@example.com',
            'password' => 'une phrase de passe solide',
            'password_confirmation' => 'une phrase de passe solide',
            'terms' => true,
            ...$overrides,
        ];
    }

    public function test_inscription_cree_un_etudiant_et_envoie_la_verification(): void
    {
        Notification::fake();
        $this->post('/inscription', $this->registration(['role' => 'admin']))->assertRedirect('/app');

        $user = User::where('email', 'awa@example.com')->firstOrFail();
        $this->assertSame('student', $user->role, 'Le rôle envoyé par le navigateur doit être ignoré.');
        $this->assertNotSame('une phrase de passe solide', $user->password);
        $this->assertNotNull($user->terms_accepted_at);
        $this->assertNull($user->email_verified_at);
        $this->assertAuthenticatedAs($user);
        Notification::assertSentTo($user, VerifyEmailFr::class);
    }

    public function test_inscription_exige_les_conditions_et_un_mot_de_passe_robuste(): void
    {
        $this->post('/inscription', $this->registration(['terms' => false, 'password' => 'court', 'password_confirmation' => 'court']))
            ->assertSessionHasErrors(['terms', 'password']);
        $this->assertGuest();
    }

    public function test_inscription_fermee(): void
    {
        app(Settings::class)->put(['accounts.registration_open' => false]);
        $this->post('/inscription', $this->registration())->assertForbidden();
    }

    public function test_l_intention_initiale_est_conservee_jusqu_au_tp(): void
    {
        Notification::fake();
        $this->get('/laboratoire/acces-internet')->assertRedirect('/connexion');
        $this->get('/inscription');
        // Le compte doit d'abord vérifier son adresse : la destination reste mémorisée.
        $this->post('/inscription', $this->registration())->assertRedirect('/laboratoire/acces-internet');
        $this->get('/laboratoire/acces-internet')->assertRedirect('/email/verification');

        $user = User::where('email', 'awa@example.com')->first();
        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1($user->email)]);
        $this->get($url)->assertRedirect('/laboratoire/acces-internet');
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    public function test_le_lien_de_confirmation_fonctionne_sans_session(): void
    {
        $user = User::factory()->unverified()->create(['email' => 'awa@example.com']);
        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1($user->email)]);

        // Ouvert dans un autre navigateur : adresse confirmée, connexion avec l'e-mail déjà saisi.
        $this->get($url)->assertRedirect('/connexion')->assertSessionHas('verified_email', 'awa@example.com');
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $this->assertGuest();
        $this->get('/connexion')->assertInertia(fn ($page) => $page->where('email', 'awa@example.com')->etc());

        // Lien modifié ou mauvais compte : refusé.
        $other = User::factory()->unverified()->create();
        $forged = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $other->id, 'hash' => sha1('awa@example.com')]);
        $this->get($forged)->assertForbidden();
        $this->get(str_replace('signature=', 'signature=x', $url))->assertForbidden();
        $this->assertFalse($other->fresh()->hasVerifiedEmail());
    }

    public function test_le_parametre_redirect_refuse_les_sites_externes(): void
    {
        $this->get('/connexion?redirect=//malveillant.example/piege');
        $this->assertNull(session('url.intended'));
        $this->get('/connexion?redirect=/laboratoire/dns');
        $this->assertStringEndsWith('/laboratoire/dns', session('url.intended'));
    }

    public function test_connexion_et_deconnexion(): void
    {
        $user = User::factory()->create(['email' => 'bob@example.com']);
        $this->post('/connexion', ['email' => 'BOB@example.com', 'password' => 'password'])->assertRedirect('/app');
        $this->assertAuthenticatedAs($user);
        $this->post('/deconnexion')->assertRedirect('/');
        $this->assertGuest();
    }

    public function test_mauvais_mot_de_passe_puis_verrouillage(): void
    {
        User::factory()->create(['email' => 'bob@example.com']);
        for ($i = 0; $i < 5; $i++) {
            $this->post('/connexion', ['email' => 'bob@example.com', 'password' => 'faux'])->assertSessionHasErrors('email');
        }
        $this->post('/connexion', ['email' => 'bob@example.com', 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertStringContainsString('Trop de tentatives', session('errors')->first('email'));
    }

    public function test_un_compte_suspendu_ne_peut_pas_se_connecter_et_est_deconnecte(): void
    {
        $user = User::factory()->create(['email' => 'bob@example.com']);
        $this->actingAs($user)->get('/app')->assertOk();
        $user->forceFill(['suspended_at' => now()])->save();
        $this->get('/app')->assertRedirect('/connexion');
        $this->assertGuest();
        $this->post('/connexion', ['email' => 'bob@example.com', 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_reinitialisation_du_mot_de_passe(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'bob@example.com']);
        $this->post('/mot-de-passe-oublie', ['email' => 'bob@example.com'])->assertSessionHas('status');
        // Même réponse pour une adresse inconnue (pas d'énumération).
        $this->post('/mot-de-passe-oublie', ['email' => 'inconnu@example.com'])->assertSessionHas('status');

        $token = null;
        Notification::assertSentTo($user, ResetPasswordFr::class, function (ResetPasswordFr $notification) use (&$token) {
            $token = $notification->token;

            return true;
        });
        $this->post('/reinitialiser-mot-de-passe', ['token' => $token, 'email' => 'bob@example.com', 'password' => 'nouvelle phrase secrète', 'password_confirmation' => 'nouvelle phrase secrète'])
            ->assertRedirect('/connexion');
        $this->post('/connexion', ['email' => 'bob@example.com', 'password' => 'nouvelle phrase secrète'])->assertRedirect();
        $this->assertAuthenticatedAs($user);
    }

    public function test_commande_de_creation_d_administrateur(): void
    {
        $this->artisan('netlab:admin', ['email' => 'chef@example.com', '--name' => 'Chef'])
            ->expectsQuestion('Mot de passe (12 caractères minimum, une phrase de passe est idéale)', 'TresSecret2026')
            ->expectsQuestion('Confirme le mot de passe', 'TresSecret2026')
            ->assertSuccessful();
        $admin = User::where('email', 'chef@example.com')->firstOrFail();
        $this->assertTrue($admin->isAdmin());
        $this->assertTrue($admin->hasVerifiedEmail());
        $this->assertDatabaseHas('admin_logs', ['action' => 'user.admin_created']);

        // Mot de passe trop faible refusé.
        $this->artisan('netlab:admin', ['email' => 'autre@example.com', '--name' => 'X'])
            ->expectsQuestion('Mot de passe (12 caractères minimum, une phrase de passe est idéale)', 'faible')
            ->expectsQuestion('Confirme le mot de passe', 'faible')
            ->assertFailed();
    }
}
