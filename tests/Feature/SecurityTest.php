<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Platform\Settings;
use App\Support\Security\Totp;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Contrôles OWASP : en-têtes, mots de passe, double authentification, journal de sécurité. */
class SecurityTest extends TestCase
{
    protected bool $seedContent = false;

    public function test_les_en_tetes_owasp_et_la_csp_avec_nonce(): void
    {
        $response = $this->get('/connexion');
        $csp = $response->headers->get('Content-Security-Policy');
        $this->assertNotNull($csp);
        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Za-z0-9+\\/=]+'/", $csp);
        foreach (["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"] as $directive) {
            $this->assertStringContainsString($directive, $csp);
        }
        $this->assertStringNotContainsString("'unsafe-eval'", $csp);
        preg_match("/'nonce-([^']+)'/", $csp, $match);
        $this->assertStringContainsString('nonce="'.$match[1].'"', $response->getContent(), 'Le script anti-flash doit porter le nonce.');

        $response->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $this->assertStringContainsString('camera=()', (string) $response->headers->get('Permissions-Policy'));
    }

    public function test_les_pages_personnelles_ne_sont_pas_mises_en_cache(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/app/securite')->assertOk();
        $this->assertStringContainsString('no-store', (string) $this->actingAs($user)->get('/app/securite')->headers->get('Cache-Control'));
    }

    public function test_politique_de_mot_de_passe_asvs(): void
    {
        $base = ['name' => 'Ada', 'email' => 'ada@example.com', 'terms' => true];
        // 11 caractères : refusé.
        $this->post('/inscription', [...$base, 'password' => 'abcdefghijk', 'password_confirmation' => 'abcdefghijk'])->assertSessionHasErrors('password');
        // Longue phrase sans chiffre ni majuscule : acceptée (pas de règle de composition).
        $this->post('/inscription', [...$base, 'password' => 'trois mots simples', 'password_confirmation' => 'trois mots simples'])->assertSessionHasNoErrors();
        $this->post('/deconnexion');
        // Plus de 128 caractères : refusé.
        $long = str_repeat('a', 129);
        $this->post('/inscription', [...$base, 'email' => 'b@example.com', 'password' => $long, 'password_confirmation' => $long])->assertSessionHasErrors('password');
    }

    public function test_totp_respecte_les_vecteurs_de_la_rfc_6238(): void
    {
        $secret = Totp::base32Encode('12345678901234567890');
        $this->assertSame('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', $secret);
        $this->assertSame('287082', Totp::code($secret, intdiv(59, 30)));
        $this->assertSame('081804', Totp::code($secret, intdiv(1111111109, 30)));
        $this->assertSame('005924', Totp::code($secret, intdiv(1234567890, 30)));
        $this->assertSame('12345678901234567890', Totp::base32Decode($secret));

        $step = Totp::verify($secret, '005924', null, 1234567890);
        $this->assertSame(intdiv(1234567890, 30), $step);
        $this->assertNull(Totp::verify($secret, '005924', $step, 1234567890), 'Un code déjà utilisé est refusé (rejeu).');
        $this->assertNull(Totp::verify($secret, '000000', null, 1234567890));
    }

    public function test_activation_de_la_double_authentification(): void
    {
        $user = User::factory()->create(['password' => 'une phrase de passe solide']);

        $this->actingAs($user)->post('/app/securite/2fa', ['password' => 'mauvais'])->assertSessionHasErrors('password');
        $this->actingAs($user)->post('/app/securite/2fa', ['password' => 'une phrase de passe solide'])->assertSessionHasNoErrors();
        $secret = session('two_factor.pending');
        $this->assertNotEmpty($secret);
        $this->assertFalse($user->fresh()->hasTwoFactor(), 'Rien n’est activé avant le premier code.');

        $this->actingAs($user)->post('/app/securite/2fa/confirmer', ['code' => '000000'])->assertSessionHasErrors('code');
        $this->actingAs($user)->post('/app/securite/2fa/confirmer', ['code' => Totp::code($secret, Totp::currentStep())])
            ->assertSessionHasNoErrors()->assertSessionHas('two_factor.codes');

        $user->refresh();
        $this->assertTrue($user->hasTwoFactor());
        $this->assertCount(8, $user->two_factor_recovery_codes);
        $raw = DB::table('users')->where('id', $user->id)->first();
        $this->assertStringNotContainsString($secret, (string) $raw->two_factor_secret, 'Le secret est chiffré en base.');
        foreach (session('two_factor.codes') as $code) {
            $this->assertStringNotContainsString(str_replace('-', '', $code), (string) $raw->two_factor_recovery_codes);
        }
    }

    private function userWithTwoFactor(): array
    {
        $secret = Totp::generateSecret();
        $user = User::factory()->create(['password' => 'une phrase de passe solide']);
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now()])->save();
        $codes = $user->regenerateRecoveryCodes();

        return [$user, $secret, $codes];
    }

    public function test_connexion_en_deux_etapes(): void
    {
        [$user, $secret] = $this->userWithTwoFactor();

        $this->post('/connexion', ['email' => $user->email, 'password' => 'une phrase de passe solide'])->assertRedirect('/connexion/verification');
        $this->assertGuest();

        $this->post('/connexion/verification', ['code' => '000000'])->assertSessionHasErrors('code');
        $this->assertGuest();

        $this->post('/connexion/verification', ['code' => Totp::code($secret, Totp::currentStep())])->assertRedirect('/app');
        $this->assertAuthenticatedAs($user);
    }

    public function test_le_code_de_verification_ne_sert_qu_une_fois_et_les_essais_sont_limites(): void
    {
        [$user, $secret] = $this->userWithTwoFactor();
        $code = Totp::code($secret, Totp::currentStep());
        $this->assertTrue($user->verifyTwoFactorCode($code));
        $this->assertFalse($user->fresh()->verifyTwoFactorCode($code), 'Rejeu refusé.');

        $this->post('/connexion', ['email' => $user->email, 'password' => 'une phrase de passe solide']);
        for ($i = 0; $i < 5; $i++) {
            $this->post('/connexion/verification', ['code' => '111111']);
        }
        $this->post('/connexion/verification', ['code' => '111111'])->assertSessionHasErrors('code');
        $this->assertStringContainsString('Trop d’essais', session('errors')->first('code'));
        $this->assertGuest();
    }

    public function test_un_code_de_secours_fonctionne_une_seule_fois(): void
    {
        [$user, , $codes] = $this->userWithTwoFactor();

        $this->post('/connexion', ['email' => $user->email, 'password' => 'une phrase de passe solide']);
        $this->post('/connexion/verification', ['recovery_code' => strtolower($codes[0])])->assertRedirect('/app');
        $this->assertAuthenticatedAs($user);
        $this->assertCount(7, $user->fresh()->two_factor_recovery_codes);
        $this->assertFalse($user->fresh()->useRecoveryCode($codes[0]));
    }

    public function test_l_administration_exige_la_double_authentification(): void
    {
        config(['netlab.security.admin_two_factor' => true]);
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin')->assertRedirect('/app/securite');

        $admin->forceFill(['two_factor_secret' => Totp::generateSecret(), 'two_factor_confirmed_at' => now()])->save();
        $this->actingAs($admin->fresh())->get('/admin')->assertOk();
    }

    public function test_desactivation_exige_mot_de_passe_et_code(): void
    {
        [$user, $secret] = $this->userWithTwoFactor();
        $this->actingAs($user)->delete('/app/securite/2fa', ['password' => 'une phrase de passe solide', 'code' => '000000'])->assertSessionHasErrors('code');
        $this->assertTrue($user->fresh()->hasTwoFactor());
        $this->actingAs($user)->delete('/app/securite/2fa', ['password' => 'une phrase de passe solide', 'code' => Totp::code($secret, Totp::currentStep())])->assertSessionHasNoErrors();
        $this->assertFalse($user->fresh()->hasTwoFactor());
    }

    public function test_le_journal_de_securite_ne_contient_ni_mot_de_passe_ni_ip(): void
    {
        $path = storage_path('logs/test-security-'.uniqid().'.log');
        config(['logging.channels.security' => ['driver' => 'single', 'path' => $path, 'level' => 'info']]);
        User::factory()->create(['email' => 'bob@example.com']);

        $this->post('/connexion', ['email' => 'bob@example.com', 'password' => 'mot-de-passe-faux-123'], ['REMOTE_ADDR' => '203.0.113.77']);
        $log = (string) file_get_contents($path);
        @unlink($path);

        $this->assertStringContainsString('login.failed', $log);
        $this->assertStringContainsString('ip_hash', $log);
        $this->assertStringNotContainsString('mot-de-passe-faux-123', $log);
        $this->assertStringNotContainsString('203.0.113.77', $log);
        $this->assertStringNotContainsString('bob@example.com', $log);
    }

    public function test_l_adresse_du_logo_refuse_les_schemas_dangereux(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->put('/admin/parametres', ['values' => ['platform.logo_url' => 'javascript:alert(1)']])->assertSessionHasErrors();
        $this->actingAs($admin)->put('/admin/parametres', ['values' => ['platform.logo_url' => '//evil.example/x.png']])->assertSessionHasErrors();
        $this->actingAs($admin)->put('/admin/parametres', ['values' => ['platform.logo_url' => '/storage/branding/logo.png']])->assertSessionHasNoErrors();
    }

    public function test_les_exports_csv_neutralisent_les_formules(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->create(['name' => '=HYPERLINK("http://evil.example","clic")']);
        $csv = $this->actingAs($admin)->get('/admin/utilisateurs/export')->assertOk()->streamedContent();
        $this->assertStringContainsString("'=HYPERLINK", $csv);
        $this->assertStringNotContainsString(';=HYPERLINK', $csv);
    }

    public function test_un_etudiant_ne_peut_pas_deviner_les_identifiants_de_comptes(): void
    {
        $student = User::factory()->create();
        $this->actingAs($student)->get('/admin/utilisateurs/'.$student->id)->assertForbidden();
        $this->actingAs($student)->get('/admin/utilisateurs/999999')->assertForbidden();
    }

    public function test_creation_du_premier_administrateur_par_variables_d_environnement(): void
    {
        putenv('NETLAB_ADMIN_EMAIL=Chef@Example.com');
        putenv('NETLAB_ADMIN_PASSWORD=court');
        $this->artisan('netlab:bootstrap-admin')->assertFailed();
        $this->assertFalse(User::where('role', User::ROLE_ADMIN)->exists());

        putenv('NETLAB_ADMIN_PASSWORD=une phrase de passe solide');
        $this->artisan('netlab:bootstrap-admin')->assertSuccessful();
        $admin = User::where('email', 'chef@example.com')->firstOrFail();
        $this->assertTrue($admin->isAdmin());

        // Relancé (redémarrage du conteneur) : ne modifie jamais un compte existant.
        putenv('NETLAB_ADMIN_EMAIL=autre@example.com');
        $this->artisan('netlab:bootstrap-admin')->assertSuccessful();
        $this->assertSame(1, User::where('role', User::ROLE_ADMIN)->count());
        putenv('NETLAB_ADMIN_EMAIL');
        putenv('NETLAB_ADMIN_PASSWORD');
    }

    public function test_security_txt(): void
    {
        $this->get('/.well-known/security.txt')->assertNotFound();
        app(Settings::class)->put(['platform.contact_email' => 'securite@example.com']);
        $this->get('/.well-known/security.txt')->assertOk()->assertSee('Contact: mailto:securite@example.com')->assertSee('Expires:');
    }
}
