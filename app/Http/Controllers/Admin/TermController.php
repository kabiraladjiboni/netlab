<?php

namespace App\Http\Controllers\Admin;

use App\Models\Lesson;
use App\Models\TechnicalTerm;
use App\Support\Text;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TermController extends AdminController
{
    public function index(Request $request): Response
    {
        $q = $request->string('q')->limit(80)->toString();

        return Inertia::render('admin/terms/index', [
            'terms' => TechnicalTerm::withCount('protocols')
                ->when($q, fn ($query) => $query->where('search_text', 'like', '%'.addcslashes(Text::normalize($q), '%_\\').'%'))
                ->orderBy('term')->paginate(40)->withQueryString()
                ->through(fn (TechnicalTerm $t) => ['id' => $t->id, 'slug' => $t->slug, 'term' => $t->term, 'category' => $t->category, 'simple' => mb_strimwidth($t->simple, 0, 120, '…'), 'protocols' => $t->protocols_count, 'status' => $t->status_publication]),
            'filters' => ['q' => $q],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/terms/edit', ['term' => null, 'options' => $this->options()]);
    }

    public function edit(TechnicalTerm $term): Response
    {
        $term->load('related:id');

        return Inertia::render('admin/terms/edit', [
            'term' => [...$term->only(['id', 'slug', 'term', 'category', 'simple', 'technical', 'example', 'status_publication']), 'aliases' => implode("\n", $term->aliases ?? []), 'related' => $term->related->pluck('id')],
            'options' => $this->options(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $term = new TechnicalTerm;
        $this->save($request, $term);
        $this->log($request, 'term.created', 'term', $term->term);

        return redirect()->route('admin.terms.edit', $term)->with('success', 'Terme créé.');
    }

    public function update(Request $request, TechnicalTerm $term): RedirectResponse
    {
        $this->save($request, $term);
        $this->log($request, 'term.updated', 'term', $term->term);

        return back()->with('success', 'Terme enregistré.');
    }

    public function destroy(Request $request, TechnicalTerm $term): RedirectResponse
    {
        $usedByLessons = Lesson::all(['concepts'])->contains(fn ($lesson) => in_array($term->slug, $lesson->concepts ?? [], true));
        if ($term->protocols()->exists() || $usedByLessons) {
            return back()->with('error', 'Ce terme est utilisé par des fiches ou des leçons : dépublie-le plutôt.');
        }
        $term->delete();
        $this->log($request, 'term.deleted', 'term', $term->term);

        return redirect()->route('admin.terms.index')->with('success', 'Terme supprimé.');
    }

    private function save(Request $request, TechnicalTerm $term): void
    {
        $data = $request->validate([
            'slug' => [...$this->slugRule(), Rule::unique('technical_terms', 'slug')->ignore($term->id)],
            'term' => ['required', 'string', 'max:120'],
            'aliases' => ['nullable', 'string', 'max:1000'],
            'category' => ['nullable', 'string', 'max:60'],
            'simple' => ['required', 'string', 'max:1500'],
            'technical' => ['required', 'string', 'max:3000'],
            'example' => ['nullable', 'string', 'max:1500'],
            'related' => ['array'], 'related.*' => ['integer', Rule::exists('technical_terms', 'id')],
            'status_publication' => ['required', Rule::in(['draft', 'published'])],
        ]);
        $aliases = $this->lines($data['aliases'] ?? '');
        $term->fill([
            ...collect($data)->only(['slug', 'term', 'category', 'simple', 'technical', 'example', 'status_publication'])->all(),
            'aliases' => $aliases,
            'content_updated_at' => now(),
            'search_text' => Text::searchable($data['term'], implode(' ', $aliases), $data['simple']),
        ])->save();
        $related = array_values(array_diff($data['related'] ?? [], [$term->id]));
        $term->related()->sync($related);
        foreach ($related as $id) {
            \Illuminate\Support\Facades\DB::table('technical_term_relations')->insertOrIgnore(['technical_term_id' => $id, 'related_term_id' => $term->id]);
        }
    }

    private function options(): array
    {
        return [
            'terms' => TechnicalTerm::orderBy('term')->get(['id', 'term']),
            'categories' => TechnicalTerm::whereNotNull('category')->distinct()->orderBy('category')->pluck('category'),
        ];
    }
}
