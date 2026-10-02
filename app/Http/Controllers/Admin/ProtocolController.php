<?php

namespace App\Http\Controllers\Admin;

use App\Models\ContentRating;
use App\Models\Equipment;
use App\Models\Favorite;
use App\Models\Lesson;
use App\Models\NetworkLayer;
use App\Models\Protocol;
use App\Models\ProtocolCategory;
use App\Models\ProtocolRelationship;
use App\Models\TechnicalTerm;
use App\Services\Learning\ScenarioCatalog;
use App\Support\Text;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Fiches protocoles. Mêmes exigences que l'import JSON : une fiche « complète »
 * doit contenir échanges, champs, erreurs fréquentes, limites et termes, et
 * chaque fiche cite au moins une référence (RFC, norme IEEE…).
 */
class ProtocolController extends AdminController
{
    public const STATUSES = [
        'standard' => 'Standard', 'extension' => 'Extension', 'mechanism' => 'Mécanisme', 'tool' => 'Outil',
        'proprietary' => 'Propriétaire', 'certification' => 'Certification', 'open-source' => 'Projet libre',
    ];

    public function index(Request $request): Response
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:80'], 'categorie' => ['nullable', 'string'], 'statut' => ['nullable', Rule::in(['draft', 'published'])]]);
        $protocols = Protocol::with('category:id,name')
            ->when($filters['q'] ?? null, fn ($query, $q) => $query->where('search_text', 'like', '%'.addcslashes(Text::normalize($q), '%_\\').'%'))
            ->when($filters['categorie'] ?? null, fn ($query, $slug) => $query->whereHas('category', fn ($c) => $c->where('slug', $slug)))
            ->when($filters['statut'] ?? null, fn ($query, $status) => $query->where('status_publication', $status))
            ->orderBy('acronym')->paginate(30)->withQueryString()
            ->through(fn (Protocol $p) => [
                'id' => $p->id, 'slug' => $p->slug, 'acronym' => $p->acronym, 'name' => $p->name, 'category' => $p->category?->name,
                'completeness' => $p->completeness, 'status' => $p->status_publication, 'updated_at' => ($p->content_updated_at ?? $p->updated_at)?->toIso8601String(),
            ]);

        return Inertia::render('admin/protocols/index', [
            'protocols' => $protocols,
            'filters' => $filters,
            'categories' => ProtocolCategory::orderBy('sort')->get(['slug', 'name']),
        ]);
    }

    public function create(ScenarioCatalog $scenarios): Response
    {
        return Inertia::render('admin/protocols/edit', ['protocol' => null, 'options' => $this->options($scenarios)]);
    }

    public function edit(Protocol $protocol, ScenarioCatalog $scenarios): Response
    {
        $protocol->load(['layers:id', 'terms:id', 'relationships', 'equipment:id']);

        return Inertia::render('admin/protocols/edit', [
            'protocol' => [
                ...$protocol->only(['id', 'slug', 'acronym', 'name', 'protocol_category_id', 'status', 'completeness', 'summary', 'problem', 'beginner', 'analogy',
                    'real_example', 'osi_note', 'tcpip_note', 'ports', 'communication', 'fields', 'packet_example', 'mistakes', 'limits', 'variants',
                    'references', 'scenario_key', 'lesson_slug', 'status_publication']),
                'layers' => $protocol->layers->pluck('id'),
                'terms' => $protocol->terms->pluck('id'),
                'equipment' => $protocol->equipment->pluck('id'),
                'related' => $protocol->relationships->map(fn (ProtocolRelationship $r) => ['protocol_id' => $r->related_protocol_id, 'type' => $r->type, 'note' => $r->note])->values(),
            ],
            'options' => $this->options($scenarios),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $protocol = new Protocol;
        $this->save($request, $protocol);
        $this->log($request, 'protocol.created', 'protocol', $protocol->acronym);

        return redirect()->route('admin.protocols.edit', $protocol)->with('success', 'Fiche créée.');
    }

    public function update(Request $request, Protocol $protocol): RedirectResponse
    {
        $before = $protocol->status_publication;
        $this->save($request, $protocol);
        $action = $before !== $protocol->status_publication ? ($protocol->status_publication === 'published' ? 'protocol.published' : 'protocol.unpublished') : 'protocol.updated';
        $this->log($request, $action, 'protocol', $protocol->acronym);

        return back()->with('success', 'Fiche enregistrée.');
    }

    public function destroy(Request $request, Protocol $protocol): RedirectResponse
    {
        $used = Favorite::where('subject_type', 'protocol')->where('subject_slug', $protocol->slug)->exists()
            || ContentRating::where('subject_type', 'protocol')->where('subject_slug', $protocol->slug)->exists();
        if ($used) {
            return back()->with('error', 'Cette fiche est en favori ou évaluée par des étudiants : dépublie-la plutôt.');
        }
        $protocol->delete();
        $this->log($request, 'protocol.deleted', 'protocol', $protocol->acronym);

        return redirect()->route('admin.protocols.index')->with('success', 'Fiche supprimée.');
    }

    private function save(Request $request, Protocol $protocol): void
    {
        $text = fn (int $max = 3000) => ['nullable', 'string', 'max:'.$max];
        $data = $request->validate([
            'slug' => [...$this->slugRule(), Rule::unique('protocols', 'slug')->ignore($protocol->id)],
            'acronym' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:190'],
            'protocol_category_id' => ['required', Rule::exists('protocol_categories', 'id')],
            'status' => ['required', Rule::in(array_keys(self::STATUSES))],
            'completeness' => ['required', Rule::in(['complete', 'essential'])],
            'summary' => ['required', 'string', 'max:1000'],
            'problem' => ['required', 'string', 'max:2000'],
            'beginner' => ['required', 'string', 'max:3000'],
            'analogy' => ['required', 'string', 'max:2000'],
            'real_example' => $text(), 'osi_note' => $text(), 'tcpip_note' => $text(),
            'ports' => ['array', 'max:20'],
            'ports.*.number' => ['required', 'string', 'max:30'],
            'ports.*.transport' => ['required', 'string', 'max:30'],
            'ports.*.note' => ['nullable', 'string', 'max:300'],
            'communication' => ['array', 'max:40'],
            'communication.*.from' => ['required', 'string', 'max:80'],
            'communication.*.to' => ['required', 'string', 'max:80'],
            'communication.*.message' => ['required', 'string', 'max:500'],
            'communication.*.note' => ['nullable', 'string', 'max:500'],
            'fields' => ['array', 'max:60'],
            'fields.*.name' => ['required', 'string', 'max:120'],
            'fields.*.size' => ['nullable', 'string', 'max:60'],
            'fields.*.description' => ['required', 'string', 'max:800'],
            'packet_example' => ['nullable', 'array'],
            'packet_example.title' => ['required_with:packet_example', 'string', 'max:190'],
            'packet_example.lines' => ['required_with:packet_example', 'array', 'max:40'],
            'packet_example.lines.*' => ['string', 'max:300'],
            'packet_example.note' => ['nullable', 'string', 'max:800'],
            'mistakes' => ['array', 'max:20'], 'mistakes.*' => ['string', 'max:800'],
            'limits' => ['array', 'max:20'], 'limits.*' => ['string', 'max:800'],
            'variants' => ['array', 'max:30'], 'variants.*' => ['string', 'max:300'],
            'references' => ['required', 'array', 'min:1', 'max:20'],
            'references.*.label' => ['required', 'string', 'max:300'],
            'references.*.url' => ['nullable', 'url', 'max:500'],
            'scenario_key' => ['nullable', Rule::exists('scenario_definitions', 'key')],
            'lesson_slug' => ['nullable', Rule::exists('lessons', 'slug')],
            'layers' => ['array'], 'layers.*' => ['integer', Rule::exists('network_layers', 'id')],
            'terms' => ['array'], 'terms.*' => ['integer', Rule::exists('technical_terms', 'id')],
            'equipment' => ['array'], 'equipment.*' => ['integer', Rule::exists('equipment', 'id')],
            'related' => ['array', 'max:40'],
            'related.*.protocol_id' => ['required', 'integer', Rule::exists('protocols', 'id')],
            'related.*.type' => ['required', Rule::in(array_keys(ProtocolRelationship::TYPES))],
            'related.*.note' => ['nullable', 'string', 'max:300'],
            'status_publication' => ['required', Rule::in(['draft', 'published'])],
        ], [
            'references.required' => 'Cite au moins une référence (RFC, norme IEEE, documentation officielle).',
            'references.min' => 'Cite au moins une référence (RFC, norme IEEE, documentation officielle).',
        ]);

        if ($data['completeness'] === 'complete') {
            $missing = collect(['communication' => 'les échanges', 'fields' => 'les champs', 'mistakes' => 'les erreurs fréquentes', 'limits' => 'les limites', 'terms' => 'les termes techniques'])
                ->filter(fn ($label, $key) => empty($data[$key]));
            if ($missing->isNotEmpty()) {
                throw ValidationException::withMessages(['completeness' => 'Une fiche « complète » doit renseigner '.$missing->implode(', ').'. Sinon, choisis « essentielle ».']);
            }
        }
        if ($protocol->exists && collect($data['related'] ?? [])->contains('protocol_id', $protocol->id)) {
            throw ValidationException::withMessages(['related' => 'Un protocole ne peut pas être lié à lui-même.']);
        }

        DB::transaction(function () use ($protocol, $data) {
            $protocol->fill([
                ...collect($data)->only(['slug', 'acronym', 'name', 'protocol_category_id', 'status', 'completeness', 'summary', 'problem', 'beginner', 'analogy', 'real_example', 'osi_note', 'tcpip_note', 'scenario_key', 'lesson_slug', 'status_publication'])->all(),
                'ports' => array_values($data['ports'] ?? []),
                'communication' => array_values($data['communication'] ?? []),
                'fields' => array_values($data['fields'] ?? []),
                'packet_example' => ! empty($data['packet_example']['lines']) ? $data['packet_example'] : null,
                'mistakes' => array_values(array_filter($data['mistakes'] ?? [])),
                'limits' => array_values(array_filter($data['limits'] ?? [])),
                'variants' => array_values(array_filter($data['variants'] ?? [])),
                'references' => array_values($data['references']),
                'content_updated_at' => now(),
                'search_text' => Text::searchable($data['acronym'], $data['name'], $data['summary'], implode(' ', array_map(fn ($port) => 'port '.$port['number'], $data['ports'] ?? []))),
            ]);
            if (! $protocol->exists) {
                $protocol->sort = (Protocol::max('sort') ?? 0) + 1;
            }
            $protocol->save();
            $protocol->layers()->sync($data['layers'] ?? []);
            $protocol->terms()->sync($data['terms'] ?? []);
            $protocol->equipment()->sync($data['equipment'] ?? []);

            // Relations déclarées par cette fiche + relation réciproque si elle n'existe pas encore.
            ProtocolRelationship::where('protocol_id', $protocol->id)->delete();
            foreach ($data['related'] ?? [] as $related) {
                ProtocolRelationship::create(['protocol_id' => $protocol->id, 'related_protocol_id' => $related['protocol_id'], 'type' => $related['type'], 'note' => $related['note'] ?? null]);
                ProtocolRelationship::firstOrCreate(
                    ['protocol_id' => $related['protocol_id'], 'related_protocol_id' => $protocol->id],
                    ['type' => ProtocolRelationship::INVERSE[$related['type']], 'note' => null],
                );
            }
        });
    }

    private function options(ScenarioCatalog $scenarios): array
    {
        return [
            'categories' => ProtocolCategory::orderBy('sort')->get(['id', 'name']),
            'statuses' => self::STATUSES,
            'layers' => NetworkLayer::orderBy('model')->orderByDesc('number')->get(['id', 'model', 'number', 'name']),
            'terms' => TechnicalTerm::orderBy('term')->get(['id', 'term']),
            'equipment' => Equipment::orderBy('name')->get(['id', 'name']),
            'protocols' => Protocol::orderBy('acronym')->get(['id', 'acronym', 'name']),
            'relationTypes' => ProtocolRelationship::TYPES,
            'scenarios' => collect($scenarios->options())->map(fn ($title, $key) => ['key' => $key, 'title' => $title])->values(),
            'lessons' => Lesson::where('kind', 'scenario')->orderBy('title')->get(['slug', 'title']),
        ];
    }
}
