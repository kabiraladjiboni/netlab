<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PagesTest extends TestCase
{
    /** @return array<string, array{0: string, 1: string}> */
    public static function pages(): array
    {
        return [
            'accueil' => ['/', 'home'],
            'parcours' => ['/apprendre', 'learn'],
            'leçon internet' => ['/lecons/acces-internet', 'lessons/show'],
            'leçon tcp' => ['/lecons/tcp-handshake', 'lessons/show'],
            'catalogue' => ['/protocoles', 'protocols/index'],
            'fiche tcp' => ['/protocoles/tcp', 'protocols/show'],
            'fiche essentielle' => ['/protocoles/dccp', 'protocols/show'],
            'osi' => ['/modeles/osi', 'models/osi'],
            'tcp-ip' => ['/modeles/tcp-ip', 'models/tcp-ip'],
            'réseaux' => ['/reseaux', 'networks'],
            'équipements' => ['/equipements', 'equipment'],
            'segmentation' => ['/segmentation', 'segmentation'],
            'wireshark' => ['/wireshark', 'wireshark'],
            'diagnostics' => ['/diagnostic', 'diagnostics/index'],
            'diagnostic' => ['/diagnostic/probleme-mtu', 'diagnostics/show'],
            'quiz' => ['/quiz', 'quiz/index'],
            'un quiz' => ['/quiz/quiz-osi', 'quiz/show'],
            'dictionnaire' => ['/dictionnaire', 'glossary'],
            'terme' => ['/dictionnaire/nat', 'glossary'],
            'cours' => ['/cours/bases-internet', 'courses/show'],
            'laboratoire' => ['/laboratoire', 'lab/index'],
            'confidentialité' => ['/confidentialite', 'legal/privacy'],
            'conditions' => ['/conditions', 'legal/terms'],
            'connexion' => ['/connexion', 'auth/login'],
            'inscription' => ['/inscription', 'auth/register'],
            'mot de passe oublié' => ['/mot-de-passe-oublie', 'auth/forgot-password'],
            'notre histoire' => ['/notre-histoire', 'story'],
        ];
    }

    #[DataProvider('pages')]
    public function test_la_page_s_affiche(string $url, string $component): void
    {
        $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component($component, false)->has('app.name'));
        $this->assertFileExists(resource_path("js/pages/{$component}.tsx"), "Composant de page manquant : {$component}");
    }

    public function test_une_fiche_inconnue_renvoie_404(): void
    {
        $this->get('/protocoles/inexistant')->assertNotFound();
        $this->get('/lecons/inexistante')->assertNotFound();
        $this->get('/dictionnaire/inexistant')->assertNotFound();
    }

    public function test_une_page_de_contenu_n_est_pas_une_lecon_animee(): void
    {
        $this->get('/lecons/osi')->assertNotFound();
    }

    public function test_la_fiche_protocole_contient_ses_relations_et_son_quiz(): void
    {
        $this->get('/protocoles/tcp')->assertInertia(fn (Assert $page) => $page
            ->where('protocol.acronym', 'TCP')
            ->where('protocol.lesson.slug', 'tcp-handshake')
            ->has('protocol.related', fn (Assert $related) => $related->each(fn (Assert $item) => $item->hasAll(['slug', 'type', 'type_label'])->etc()))
            ->has('protocol.quiz.questions')
            ->etc());
    }

    public function test_la_lecon_publique_propose_un_apercu_et_le_quiz(): void
    {
        $this->get('/lecons/acces-internet')->assertInertia(fn (Assert $page) => $page
            ->where('lesson.scenario_key', 'acces-internet')
            ->where('access', 'guest')
            ->where('labAvailable', true)
            ->where('previewSteps', 3)
            ->has('quiz.questions')
            ->etc());
    }

    public function test_le_laboratoire_transmet_la_variante_demandee(): void
    {
        $user = \App\Models\User::factory()->create();
        $this->actingAs($user)->get('/laboratoire/acces-internet?variante=quic')->assertInertia(fn (Assert $page) => $page
            ->component('lab/show', false)
            ->where('initialVariant', 'quic')
            ->etc());
    }

    public function test_les_en_tetes_de_securite_sont_presents(): void
    {
        $this->get('/')->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('X-Frame-Options', 'DENY');
    }
}
