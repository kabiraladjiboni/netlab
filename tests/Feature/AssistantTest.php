<?php

namespace Tests\Feature;

use App\Services\Assistant\AssistantService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AssistantTest extends TestCase
{
    public function test_sans_ia_l_assistant_repond_avec_le_contenu_valide(): void
    {
        $response = $this->postJson('/api/assistant', [
            'question' => 'Pourquoi DNS est-il nécessaire ?',
            'level' => 1,
            'context' => ['page' => 'lesson', 'title' => 'Accès à Internet'],
        ])->assertOk();

        $response->assertJsonPath('mode', 'fallback');
        $this->assertStringContainsString('annuaire', $response->json('answer'));
        $this->assertStringContainsString('Mode IA non activé', $response->json('notice'));
        $this->assertNotEmpty($response->json('sources'));
    }

    public function test_la_reponse_s_adapte_au_niveau(): void
    {
        $beginner = $this->postJson('/api/assistant', ['question' => 'Différence entre TCP et UDP ?', 'level' => 1])->json('answer');
        $advanced = $this->postJson('/api/assistant', ['question' => 'Différence entre TCP et UDP ?', 'level' => 3])->json('answer');
        $this->assertNotSame($beginner, $advanced);
        $this->assertStringContainsString('RFC', $advanced);
    }

    public function test_un_terme_du_dictionnaire_est_utilise_en_repli(): void
    {
        $answer = $this->postJson('/api/assistant', ['question' => 'Explique-moi la gigue', 'level' => 2])->json('answer');
        $this->assertStringContainsString('Gigue', $answer);
    }

    public function test_les_entrees_sont_validees(): void
    {
        $this->postJson('/api/assistant', ['question' => '', 'level' => 1])->assertUnprocessable();
        $this->postJson('/api/assistant', ['question' => 'ok ?', 'level' => 9])->assertUnprocessable();
        $this->postJson('/api/assistant', ['question' => str_repeat('a', 700), 'level' => 1])->assertUnprocessable();
    }

    public function test_avec_un_fournisseur_configure_la_cle_reste_cote_serveur(): void
    {
        config(['netlab.ai.provider' => 'anthropic', 'netlab.ai.api_key' => 'cle-secrete-de-test']);
        $this->app->forgetInstance(AssistantService::class);
        Http::fake(['api.anthropic.com/*' => Http::response(['content' => [['type' => 'text', 'text' => 'Réponse **IA** de test.']]])]);

        $response = $this->postJson('/api/assistant', ['question' => 'Pourquoi le NAT ?', 'level' => 2])->assertOk();
        $response->assertJsonPath('mode', 'ai')->assertJsonPath('answer', 'Réponse **IA** de test.');
        $this->assertStringNotContainsString('cle-secrete-de-test', $response->getContent());

        Http::assertSent(fn ($request) => $request->hasHeader('x-api-key', 'cle-secrete-de-test')
            && str_contains($request['system'], 'N\'invente JAMAIS'));

        $page = $this->get('/')->getContent();
        $this->assertStringNotContainsString('cle-secrete-de-test', $page);
    }

    public function test_si_l_ia_echoue_on_bascule_sur_le_repli(): void
    {
        config(['netlab.ai.provider' => 'openai', 'netlab.ai.api_key' => 'cle']);
        $this->app->forgetInstance(AssistantService::class);
        Http::fake(['api.openai.com/*' => Http::response(['error' => 'surcharge'], 503)]);

        $this->postJson('/api/assistant', ['question' => 'Pourquoi DNS est-il nécessaire ?', 'level' => 1])
            ->assertOk()
            ->assertJsonPath('mode', 'fallback');
    }
}
