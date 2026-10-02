<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ProvidesEngagement;
use App\Models\Protocol;
use App\Models\ProtocolCategory;
use App\Services\Analytics\Tracker;
use App\Services\Content\QuizGenerator;
use App\Services\Learning\LabAccess;
use Illuminate\Http\Request;
use App\Support\Presenters\ContentPresenter;
use App\Support\Seo\Seo;
use Inertia\Inertia;
use Inertia\Response;

class ProtocolController extends Controller
{
    use ProvidesEngagement;

    public function index(Seo $seo): Response
    {
        $categories = ProtocolCategory::with(['protocols' => fn ($query) => $query->published()->with(['layers', 'category'])])->orderBy('sort')->get();
        $count = $categories->sum(fn (ProtocolCategory $category) => $category->protocols->count());
        $seo->title("Catalogue des protocoles réseau : {$count} fiches")
            ->description("{$count} protocoles réseau expliqués : rôle, ports, couche OSI, fonctionnement et erreurs fréquentes. DNS, DHCP, TCP, UDP, TLS, HTTP, ARP, BGP, OSPF…")
            ->breadcrumbs([['Protocoles', '/protocoles']])
            ->schema([
                '@type' => 'CollectionPage',
                'name' => 'Catalogue des protocoles réseau',
                'url' => $seo->url('/protocoles'),
                'hasPart' => $categories->flatMap(fn (ProtocolCategory $category) => $category->protocols)->map(fn (Protocol $protocol) => [
                    '@type' => 'TechArticle', 'headline' => $protocol->acronym.' — '.$protocol->name, 'url' => $seo->url('/protocoles/'.$protocol->slug),
                ])->values()->all(),
            ]);

        return Inertia::render('protocols/index', [
            'categories' => $categories->map(fn (ProtocolCategory $category) => [
                'slug' => $category->slug,
                'name' => $category->name,
                'description' => $category->description,
                'planned' => $category->planned ?? [],
                'protocols' => $category->protocols->map(fn (Protocol $protocol) => ContentPresenter::protocolSummary($protocol))->values(),
            ]),
        ]);
    }

    public function show(Request $request, string $slug, QuizGenerator $quizzes, Tracker $tracker, LabAccess $access): Response
    {
        $protocol = Protocol::with(['category', 'layers', 'relationships.related', 'terms'])->where('slug', $slug)->firstOrFail();
        $this->ensureVisible($request->user(), $protocol->isPublished());
        $this->describe(app(Seo::class), $protocol);
        $tracker->recordOnce($request, 'protocol_view', 'protocol', $protocol->slug);
        $siblings = Protocol::published()->where('protocol_category_id', $protocol->protocol_category_id)->orderBy('sort')->get(['slug', 'acronym']);

        return Inertia::render('protocols/show', [
            'protocol' => [...ContentPresenter::protocolDetail($protocol), 'quiz' => $quizzes->forProtocol($protocol)],
            'engagement' => $this->engagement($request->user(), 'protocol', $protocol->slug),
            'access' => $access->status($request->user()),
            'draft' => ! $protocol->isPublished(),
            'siblings' => $siblings->map(fn (Protocol $item) => ['slug' => $item->slug, 'acronym' => $item->acronym])->values(),
        ]);
    }

    /** Titre du type « DNS (Domain Name System) : rôle, port 53 et fonctionnement ». */
    private function describe(Seo $seo, Protocol $protocol): void
    {
        $ports = collect($protocol->ports ?? [])->pluck('number')->filter()->map(fn ($n) => (string) $n)->unique()->values();
        $portText = match (true) {
            $ports->isEmpty() => '',
            $ports->count() === 1 => ', port '.$ports->first(),
            $ports->count() <= 3 => ', ports '.$ports->implode(', '),
            default => ', ports',
        };
        $name = $protocol->name && strcasecmp($protocol->name, $protocol->acronym) !== 0 ? $protocol->acronym.' ('.$protocol->name.')' : $protocol->acronym;
        $layers = $protocol->layers->where('model', 'osi')->pluck('name')->implode(', ');
        $description = trim(Seo::clean((string) $protocol->summary).($layers ? ' Couche OSI : '.$layers.'.' : '').($ports->isNotEmpty() ? ' Port'.($ports->count() > 1 ? 's' : '').' : '.$ports->take(4)->implode(', ').'.' : ''));
        $category = $protocol->category;

        $seo->title($name.' : rôle'.$portText.' et fonctionnement')
            ->description($description)
            ->type('article')
            ->modified($protocol->updated_at)
            ->breadcrumbs(array_values(array_filter([
                ['Protocoles', '/protocoles'],
                $category ? [$category->name, '/protocoles#'.$category->slug] : null,
                [$protocol->acronym, '/protocoles/'.$protocol->slug],
            ])))
            ->schema(array_filter([
                '@type' => 'TechArticle',
                'headline' => Seo::excerpt($name.' : rôle et fonctionnement', 110),
                'description' => $description,
                'url' => $seo->url('/protocoles/'.$protocol->slug),
                'inLanguage' => 'fr',
                'isAccessibleForFree' => true,
                'dateModified' => $protocol->updated_at?->format(DATE_ATOM),
                'author' => ['@id' => $seo->baseUrl().'/#organisation'],
                'publisher' => ['@id' => $seo->baseUrl().'/#organisation'],
                'about' => ['@type' => 'DefinedTerm', 'name' => $protocol->acronym, 'alternateName' => $protocol->name],
                'proficiencyLevel' => $protocol->completeness === 'complete' ? 'Expert' : 'Beginner',
                'image' => $seo->url(Seo::DEFAULT_IMAGE),
            ], fn ($value) => $value !== null && $value !== ''));

        if (! $protocol->isPublished()) {
            $seo->noindex();
        }
    }
}
