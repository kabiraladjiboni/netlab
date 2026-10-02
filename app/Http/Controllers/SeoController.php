<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Diagnostic;
use App\Models\Lesson;
use App\Models\Protocol;
use App\Models\Quiz;
use App\Models\TechnicalTerm;
use App\Services\Platform\Settings;
use App\Support\Seo\Seo;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

/** Fichiers destinés aux moteurs de recherche et aux navigateurs. */
class SeoController extends Controller
{
    /** Pages publiques fixes : [chemin, priorité, fréquence]. */
    private const STATIC_PAGES = [
        ['/', '1.0', 'weekly'],
        ['/apprendre', '0.9', 'weekly'],
        ['/laboratoire', '0.9', 'weekly'],
        ['/protocoles', '0.9', 'weekly'],
        ['/dictionnaire', '0.8', 'weekly'],
        ['/modeles/osi', '0.8', 'monthly'],
        ['/modeles/tcp-ip', '0.8', 'monthly'],
        ['/reseaux', '0.7', 'monthly'],
        ['/equipements', '0.7', 'monthly'],
        ['/segmentation', '0.7', 'monthly'],
        ['/wireshark', '0.8', 'monthly'],
        ['/diagnostic', '0.7', 'monthly'],
        ['/quiz', '0.6', 'monthly'],
        ['/notre-histoire', '0.5', 'yearly'],
        ['/confidentialite', '0.2', 'yearly'],
        ['/conditions', '0.2', 'yearly'],
    ];

    public function robots(Seo $seo): Response
    {
        $lines = ['# '.$seo->brand(), 'User-agent: *'];

        if (! app()->isProduction()) {
            // Environnement de test ou local : ne jamais être indexé par erreur.
            $lines[] = 'Disallow: /';
        } else {
            array_push($lines,
                'Disallow: /admin',
                'Disallow: /app$',
                'Disallow: /app/',
                'Disallow: /api/',
                'Disallow: /laboratoire/',
                'Disallow: /connexion',
                'Disallow: /inscription',
                'Disallow: /mot-de-passe-oublie',
                'Disallow: /reinitialiser-mot-de-passe/',
                'Disallow: /email/',
                'Allow: /',
            );
        }
        $lines[] = '';
        $lines[] = 'Sitemap: '.$seo->url('/sitemap.xml');

        return response(implode("\n", $lines)."\n", 200, ['Content-Type' => 'text/plain; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }

    public function sitemap(Seo $seo): Response
    {
        $base = $seo->baseUrl();
        $xml = Cache::remember('seo.sitemap.'.md5($base), now()->addHour(), function () use ($seo) {
            $urls = [];
            $add = function (string $path, ?\DateTimeInterface $modified, string $priority, string $frequency) use (&$urls, $seo) {
                $urls[] = '  <url><loc>'.e($path === '/' ? $seo->baseUrl().'/' : $seo->url($path)).'</loc>'
                    .($modified ? '<lastmod>'.$modified->format('Y-m-d').'</lastmod>' : '')
                    .'<changefreq>'.$frequency.'</changefreq><priority>'.$priority.'</priority></url>';
            };

            $latest = collect([Protocol::max('updated_at'), Lesson::max('updated_at'), TechnicalTerm::max('updated_at')])->filter()->max();
            foreach (self::STATIC_PAGES as [$path, $priority, $frequency]) {
                $add($path, $latest ? new \DateTimeImmutable((string) $latest) : null, $priority, $frequency);
            }
            Course::published()->orderBy('sort')->get()->each(fn (Course $c) => $add('/cours/'.$c->slug, $c->updated_at, '0.8', 'monthly'));
            Lesson::published()->where('kind', 'scenario')->orderBy('sort')->get()
                ->each(fn (Lesson $l) => $add('/lecons/'.$l->slug, $l->updated_at, '0.8', 'monthly'));
            Protocol::published()->orderBy('sort')->get()->each(fn (Protocol $p) => $add('/protocoles/'.$p->slug, $p->updated_at, $p->completeness === 'complete' ? '0.8' : '0.6', 'monthly'));
            TechnicalTerm::published()->orderBy('term')->get()->each(fn (TechnicalTerm $t) => $add('/dictionnaire/'.$t->slug, $t->updated_at, '0.5', 'monthly'));
            Quiz::published()->get()->each(fn (Quiz $q) => $add('/quiz/'.$q->slug, $q->updated_at, '0.4', 'monthly'));
            Diagnostic::published()->orderBy('sort')->get()->each(fn (Diagnostic $d) => $add('/diagnostic/'.$d->slug, $d->updated_at, '0.6', 'monthly'));

            return '<?xml version="1.0" encoding="UTF-8"?>'."\n"
                .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n"
                .implode("\n", $urls)."\n</urlset>\n";
        });

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }

    /** RFC 9116 : où signaler une faille de sécurité. Publié seulement si une adresse de contact existe. */
    public function securityTxt(Settings $settings, Seo $seo): Response
    {
        $contact = $settings->get('platform.contact_email');
        abort_if(! $contact, 404);
        $body = implode("\n", [
            'Contact: mailto:'.$contact,
            'Expires: '.now()->addYear()->startOfDay()->toIso8601ZuluString(),
            'Preferred-Languages: fr, en',
            'Canonical: '.$seo->url('/.well-known/security.txt'),
            'Policy: '.$seo->url('/conditions'),
        ])."\n";

        return response($body, 200, ['Content-Type' => 'text/plain; charset=UTF-8', 'Cache-Control' => 'public, max-age=86400']);
    }

    public function manifest(Settings $settings): Response
    {
        $name = $settings->platformName();
        $manifest = [
            'name' => $name,
            'short_name' => $name,
            'description' => 'Apprendre les réseaux informatiques avec des animations interactives et des TP virtuels.',
            'lang' => 'fr',
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'background_color' => '#101D35',
            'theme_color' => '#101D35',
            'icons' => [
                ['src' => '/brand/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
                ['src' => '/brand/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png'],
                ['src' => '/brand/icon-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
        ];

        return response(json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), 200, [
            'Content-Type' => 'application/manifest+json; charset=UTF-8',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
