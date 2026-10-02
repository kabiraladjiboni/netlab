<?php

namespace Tests\Feature;

use App\Models\Protocol;
use Tests\TestCase;

/** Référencement : balises par page, données structurées, robots.txt, sitemap. */
class SeoTest extends TestCase
{
    /** @return array<int, string> */
    private function headTags(string $url): array
    {
        return $this->get($url)->assertOk()->viewData('page')['props']['head'];
    }

    private function jsonLd(array $head): array
    {
        $script = collect($head)->first(fn ($tag) => str_contains($tag, 'application/ld+json'));
        $this->assertNotNull($script, 'Données structurées absentes.');
        $json = preg_replace('#^<script[^>]*>|</script>$#', '', $script);

        return json_decode($json, true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_une_fiche_protocole_a_titre_description_canonique_et_donnees_structurees(): void
    {
        $head = implode("\n", $tags = $this->headTags('/protocoles/dns'));
        $this->assertStringContainsString('<title data-inertia="">DNS (Domain Name System) : rôle, port 53 et fonctionnement · Abòrò Labs</title>', $head);
        $this->assertStringContainsString('rel="canonical" href="'.url('/protocoles/dns').'"', $head);
        $this->assertStringContainsString('name="description"', $head);
        $this->assertStringContainsString('property="og:image"', $head);
        $this->assertStringContainsString('name="twitter:card" content="summary_large_image"', $head);
        $this->assertStringContainsString('content="index, follow', $head);

        $types = collect($this->jsonLd($tags)['@graph'])->pluck('@type')->all();
        foreach (['EducationalOrganization', 'WebSite', 'WebPage', 'BreadcrumbList', 'TechArticle'] as $type) {
            $this->assertContains($type, $types);
        }
    }

    public function test_les_balises_sont_rendues_dans_le_html_sans_serveur_ssr(): void
    {
        $html = $this->get('/protocoles/tcp')->getContent();
        $this->assertSame(1, substr_count($html, '<title'));
        $this->assertStringContainsString('<link data-inertia="seo-canonical" rel="canonical"', $html);
        $this->assertStringContainsString('<meta data-inertia="seo-description" name="description"', $html);
        $this->assertStringContainsString('application/ld+json', $html);
    }

    public function test_chaque_page_publique_a_sa_propre_description(): void
    {
        $descriptions = [];
        foreach (['/', '/apprendre', '/laboratoire', '/protocoles', '/protocoles/tcp', '/modeles/osi', '/modeles/tcp-ip', '/reseaux', '/equipements', '/segmentation', '/wireshark', '/diagnostic', '/quiz', '/dictionnaire', '/dictionnaire/nat', '/cours/bases-internet', '/lecons/acces-internet', '/notre-histoire'] as $url) {
            $tag = collect($this->headTags($url))->first(fn ($t) => str_contains($t, 'seo-description'));
            preg_match('/content="([^"]+)"/', $tag, $m);
            $this->assertNotEmpty($m[1] ?? null, $url);
            $this->assertLessThanOrEqual(170, mb_strlen(html_entity_decode($m[1])), $url);
            $descriptions[$url] = $m[1];
        }
        $this->assertSame(count($descriptions), count(array_unique($descriptions)), 'Descriptions en double.');
    }

    public function test_les_pages_privees_ne_sont_pas_indexees(): void
    {
        $head = implode("\n", $this->headTags('/connexion'));
        $this->assertStringContainsString('noindex, nofollow', $head);
        $this->assertStringNotContainsString('rel="canonical"', $head);
    }

    public function test_robots_txt(): void
    {
        $this->get('/robots.txt')->assertOk()->assertSee('Disallow: /')->assertSee('Sitemap: '.url('/sitemap.xml'));

        $this->app['env'] = 'production';
        $body = $this->get('/robots.txt')->getContent();
        $this->assertStringContainsString('Disallow: /admin', $body);
        $this->assertStringContainsString('Disallow: /app/', $body);
        $this->assertStringNotContainsString("Disallow: /\n", $body);
    }

    public function test_sitemap_xml(): void
    {
        $draft = Protocol::where('slug', 'tcp')->first();
        $draft->update(['status_publication' => 'draft']);

        $xml = $this->get('/sitemap.xml')->assertOk()->assertHeader('Content-Type', 'application/xml; charset=UTF-8')->getContent();
        $doc = simplexml_load_string($xml);
        $this->assertNotFalse($doc);
        $this->assertStringContainsString('<loc>'.url('/protocoles/dns').'</loc>', $xml);
        $this->assertStringContainsString('<loc>'.url('/dictionnaire/nat').'</loc>', $xml);
        $this->assertStringContainsString('<loc>'.url('/lecons/acces-internet').'</loc>', $xml);
        $this->assertStringNotContainsString('/protocoles/tcp<', $xml, 'Un brouillon ne doit pas apparaître.');
        $this->assertStringNotContainsString('/admin', $xml);
    }

    public function test_manifeste_web(): void
    {
        $this->get('/site.webmanifest')->assertOk()->assertJsonPath('name', 'Abòrò Labs')->assertJsonPath('lang', 'fr');
    }
}
