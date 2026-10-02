<?php

namespace Tests\Feature;

use Tests\TestCase;

class SearchTest extends TestCase
{
    public function test_un_sigle_retrouve_sa_fiche_en_premier(): void
    {
        $results = $this->getJson('/api/recherche?q=TCP')->assertOk()->json('results');
        $this->assertSame('/protocoles/tcp', $results[0]['href']);
    }

    public function test_la_recherche_ignore_les_accents_et_la_casse(): void
    {
        $hrefs = collect($this->getJson('/api/recherche?q=RESOLVEUR')->json('results'))->pluck('href');
        $this->assertContains('/dictionnaire/resolveur-dns', $hrefs);
    }

    public function test_la_recherche_trouve_couches_termes_et_types_de_reseaux(): void
    {
        $this->assertContains('/modeles/osi?couche=4', collect($this->getJson('/api/recherche?q=transport')->json('results'))->pluck('href'));
        $this->assertContains('/dictionnaire/adresse-mac', collect($this->getJson('/api/recherche?q=adresse mac')->json('results'))->pluck('href'));
        $this->assertContains('/reseaux?type=wan', collect($this->getJson('/api/recherche?q=wan')->json('results'))->pluck('href'));
    }

    public function test_un_port_permet_de_trouver_le_protocole(): void
    {
        $this->assertContains('/protocoles/dns', collect($this->getJson('/api/recherche?q=port 53')->json('results'))->pluck('href'));
    }

    public function test_les_caracteres_speciaux_ne_cassent_pas_la_requete(): void
    {
        $this->getJson('/api/recherche?q='.urlencode("%_' OR 1=1 --"))->assertOk();
        $this->getJson('/api/recherche')->assertUnprocessable();
    }

    public function test_l_api_des_termes(): void
    {
        $this->getJson('/api/termes/nat')->assertOk()->assertJsonPath('term', 'NAT')->assertJsonStructure(['simple', 'technical', 'related', 'protocols']);
        $this->getJson('/api/termes/inconnu')->assertNotFound();
    }
}
