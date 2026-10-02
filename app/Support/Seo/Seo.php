<?php

namespace App\Support\Seo;

use App\Services\Platform\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Métadonnées de référencement de la page en cours (une instance par requête).
 *
 * Les contrôleurs décrivent la page (titre, description, fil d'Ariane, données
 * structurées) ; le middleware Inertia transmet les balises dans la prop `head`.
 * Elles sont alors :
 *  - rendues par le serveur SSR, ou par app.blade.php si le SSR est arrêté ;
 *  - mises à jour par Inertia à chaque navigation côté client.
 * Chaque balise porte une clé `data-inertia` stable, ce qui évite les doublons.
 */
final class Seo
{
    private ?string $title = null;

    private bool $titleIsFull = false;

    private ?string $description = null;

    private ?string $canonicalPath = null;

    private bool $indexable = true;

    private string $type = 'website';

    private ?string $image = null;

    private ?string $imageAlt = null;

    /** @var array<int, array{0: string, 1: string}> */
    private array $breadcrumbs = [];

    /** @var array<int, array<string, mixed>> */
    private array $schemas = [];

    private ?string $modifiedAt = null;

    public const DEFAULT_IMAGE = '/brand/og/aboro-labs-partage-1200x630.jpg';

    public function __construct(private readonly Settings $settings, private readonly Request $request) {}

    /** Titre de la page ; le nom de la plateforme est ajouté sauf si `$full`. */
    public function title(string $title, bool $full = false): self
    {
        $this->title = self::clean($title);
        $this->titleIsFull = $full;

        return $this;
    }

    public function description(?string $description): self
    {
        if ($description !== null && trim($description) !== '') {
            $this->description = self::excerpt($description, 158);
        }

        return $this;
    }

    /** Chemin canonique (par défaut : chemin de la requête, sans paramètres). */
    public function canonical(string $path): self
    {
        $this->canonicalPath = '/'.ltrim($path, '/');

        return $this;
    }

    public function noindex(): self
    {
        $this->indexable = false;

        return $this;
    }

    public function isIndexable(): bool
    {
        return $this->indexable;
    }

    public function type(string $type): self
    {
        $this->type = $type;

        return $this;
    }

    public function image(string $path, ?string $alt = null): self
    {
        $this->image = $path;
        $this->imageAlt = $alt;

        return $this;
    }

    public function modified(?\DateTimeInterface $date): self
    {
        $this->modifiedAt = $date?->format(DATE_ATOM);

        return $this;
    }

    /**
     * Fil d'Ariane (l'accueil est ajouté automatiquement).
     *
     * @param  array<int, array{0: string, 1: string}>  $items  [libellé, chemin]
     */
    public function breadcrumbs(array $items): self
    {
        $this->breadcrumbs = $items;

        return $this;
    }

    /** @param  array<string, mixed>  $schema  objet schema.org (sans @context) */
    public function schema(array $schema): self
    {
        $this->schemas[] = $schema;

        return $this;
    }

    public function brand(): string
    {
        return $this->settings->platformName();
    }

    public function fullTitle(): ?string
    {
        if ($this->title === null) {
            return null;
        }

        return $this->titleIsFull ? $this->title : $this->title.' · '.$this->brand();
    }

    public function defaultDescription(): string
    {
        return self::excerpt((string) ($this->settings->get('platform.description') ?: config('netlab.tagline')), 158);
    }

    /**
     * Racine absolue des liens publics. En production, APP_URL fait foi (et protège
     * des en-têtes Host forgés) ; ailleurs, l'adresse réellement utilisée.
     */
    public function baseUrl(): string
    {
        if (app()->isProduction()) {
            return rtrim((string) config('app.url'), '/');
        }

        return rtrim($this->request->getSchemeAndHttpHost(), '/');
    }

    public function url(string $path): string
    {
        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        return $this->baseUrl().'/'.ltrim($path, '/');
    }

    public function canonicalUrl(): string
    {
        $path = $this->canonicalPath ?? '/'.ltrim($this->request->path(), '/');

        return $path === '/' ? $this->baseUrl().'/' : $this->url($path);
    }

    /** Organisation éditrice, réutilisée dans les données structurées. */
    public function organization(): array
    {
        return [
            '@type' => 'EducationalOrganization',
            '@id' => $this->baseUrl().'/#organisation',
            'name' => $this->brand(),
            'url' => $this->baseUrl().'/',
            'logo' => [
                '@type' => 'ImageObject',
                'url' => $this->url('/brand/aboro-labs-symbole-512.png'),
                'width' => 512,
                'height' => 512,
            ],
            'slogan' => config('netlab.slogan'),
        ];
    }

    /**
     * Balises de l'en-tête, avec une clé `data-inertia` stable chacune.
     *
     * @return array<int, string>
     */
    public function tags(): array
    {
        $tags = [];
        $title = $this->fullTitle();
        $description = $this->description ?? $this->defaultDescription();
        $canonical = $this->canonicalUrl();
        $image = $this->url($this->image ?? self::DEFAULT_IMAGE);
        $alt = $this->imageAlt ?? $this->brand().' — '.config('netlab.slogan');
        $ogTitle = $title ?? $this->brand().' — '.config('netlab.slogan');

        if ($title !== null) {
            $tags[] = '<title data-inertia="">'.e($title).'</title>';
        }

        $meta = fn (string $key, string $attr, string $name, string $content) => '<meta data-inertia="seo-'.$key.'" '.$attr.'="'.e($name).'" content="'.e($content).'">';

        $tags[] = $meta('description', 'name', 'description', $description);
        $tags[] = $meta('robots', 'name', 'robots', $this->indexable ? 'index, follow, max-image-preview:large, max-snippet:-1' : 'noindex, nofollow');

        if ($this->indexable) {
            $tags[] = '<link data-inertia="seo-canonical" rel="canonical" href="'.e($canonical).'">';
        }

        $tags[] = $meta('og-type', 'property', 'og:type', $this->type);
        $tags[] = $meta('og-site', 'property', 'og:site_name', $this->brand());
        $tags[] = $meta('og-locale', 'property', 'og:locale', 'fr_FR');
        $tags[] = $meta('og-title', 'property', 'og:title', $ogTitle);
        $tags[] = $meta('og-description', 'property', 'og:description', $description);
        $tags[] = $meta('og-url', 'property', 'og:url', $canonical);
        $tags[] = $meta('og-image', 'property', 'og:image', $image);
        if ($this->image === null) {
            $tags[] = $meta('og-image-w', 'property', 'og:image:width', '1200');
            $tags[] = $meta('og-image-h', 'property', 'og:image:height', '630');
        }
        $tags[] = $meta('og-image-alt', 'property', 'og:image:alt', $alt);
        if ($this->modifiedAt !== null) {
            $tags[] = $meta('modified', 'property', 'article:modified_time', $this->modifiedAt);
        }
        $tags[] = $meta('tw-card', 'name', 'twitter:card', 'summary_large_image');
        $tags[] = $meta('tw-title', 'name', 'twitter:title', $ogTitle);
        $tags[] = $meta('tw-description', 'name', 'twitter:description', $description);
        $tags[] = $meta('tw-image', 'name', 'twitter:image', $image);

        if ($this->indexable) {
            $graph = $this->graph($ogTitle, $description, $canonical);
            $json = json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
            $tags[] = '<script data-inertia="seo-jsonld" type="application/ld+json">'.$json.'</script>';
        }

        return $tags;
    }

    /** @return array<int, array<string, mixed>> */
    private function graph(string $title, string $description, string $canonical): array
    {
        $graph = [
            $this->organization(),
            [
                '@type' => 'WebSite',
                '@id' => $this->baseUrl().'/#site',
                'url' => $this->baseUrl().'/',
                'name' => $this->brand(),
                'description' => $this->defaultDescription(),
                'inLanguage' => 'fr',
                'publisher' => ['@id' => $this->baseUrl().'/#organisation'],
            ],
            [
                '@type' => 'WebPage',
                '@id' => $canonical.'#page',
                'url' => $canonical,
                'name' => $title,
                'description' => $description,
                'inLanguage' => 'fr',
                'isPartOf' => ['@id' => $this->baseUrl().'/#site'],
                ...($this->breadcrumbs !== [] ? ['breadcrumb' => ['@id' => $canonical.'#ariane']] : []),
                ...($this->modifiedAt !== null ? ['dateModified' => $this->modifiedAt] : []),
            ],
        ];

        if ($this->breadcrumbs !== []) {
            $items = [['Accueil', '/'], ...$this->breadcrumbs];
            $graph[] = [
                '@type' => 'BreadcrumbList',
                '@id' => $canonical.'#ariane',
                'itemListElement' => array_map(fn (array $item, int $index) => [
                    '@type' => 'ListItem',
                    'position' => $index + 1,
                    'name' => $item[0],
                    'item' => $item[1] === '/' ? $this->baseUrl().'/' : $this->url($item[1]),
                ], $items, array_keys($items)),
            ];
        }

        foreach ($this->schemas as $schema) {
            $graph[] = $schema;
        }

        return $graph;
    }

    public static function clean(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? '');
    }

    /** Coupe proprement un texte (sur un mot) pour une meta description. */
    public static function excerpt(string $text, int $limit): string
    {
        $text = self::clean($text);
        if (mb_strlen($text) <= $limit) {
            return $text;
        }
        $cut = mb_substr($text, 0, $limit - 1);
        $space = mb_strrpos($cut, ' ');

        return rtrim(mb_substr($cut, 0, $space !== false && $space > $limit * 0.6 ? $space : $limit - 1), ' ,;:.').'…';
    }

    /** Durée ISO 8601 (minutes) pour schema.org. */
    public static function duration(?int $minutes): ?string
    {
        return $minutes !== null && $minutes > 0 ? 'PT'.$minutes.'M' : null;
    }
}
