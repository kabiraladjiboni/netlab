<?php

namespace App\Http\Controllers\Admin;

use App\Models\LabSession;
use App\Models\Lesson;
use App\Models\Protocol;
use App\Models\ScenarioDefinition;
use App\Services\Learning\ScenarioCatalog;
use App\Services\Learning\ScenarioValidator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Scénarios pédagogiques. Les scénarios intégrés (code) peuvent être publiés
 * ou retirés ; les scénarios personnalisés sont des DONNÉES JSON validées
 * (aucun code exécuté) jouées par le moteur d'animation existant.
 */
class ScenarioController extends AdminController
{
    public function index(ScenarioCatalog $catalog): Response
    {
        $catalog->syncBuiltins();
        $lessons = Lesson::whereNotNull('scenario_key')->get(['slug', 'title', 'scenario_key'])->groupBy('scenario_key');
        $usage = LabSession::where('lab_type', 'scenario')->selectRaw('lab_slug, COUNT(*) as n')->groupBy('lab_slug')->pluck('n', 'lab_slug');

        return Inertia::render('admin/scenarios/index', [
            'scenarios' => ScenarioDefinition::orderBy('source')->orderBy('title')->get()->map(fn (ScenarioDefinition $s) => [
                'id' => $s->id, 'key' => $s->key, 'title' => $s->title, 'description' => $s->description, 'source' => $s->source,
                'status' => $s->status_publication, 'validated_at' => $s->validated_at?->toIso8601String(), 'updated_at' => $s->updated_at?->toIso8601String(),
                'lessons' => ($lessons[$s->key] ?? collect())->map(fn ($l) => ['slug' => $l->slug, 'title' => $l->title, 'sessions' => (int) ($usage[$l->slug] ?? 0)])->values(),
            ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/scenarios/edit', ['scenario' => null]);
    }

    public function edit(ScenarioDefinition $scenario): Response
    {
        return Inertia::render('admin/scenarios/edit', [
            'scenario' => [
                'id' => $scenario->id, 'key' => $scenario->key, 'title' => $scenario->title, 'description' => $scenario->description,
                'source' => $scenario->source, 'definition' => ScenarioCatalog::forClient($scenario->definition), 'status' => $scenario->status_publication,
                'validated_at' => $scenario->validated_at?->toIso8601String(),
            ],
        ]);
    }

    public function store(Request $request, ScenarioValidator $validator): RedirectResponse
    {
        $scenario = new ScenarioDefinition(['source' => 'custom', 'status_publication' => 'draft']);
        $this->saveCustom($request, $scenario, $validator);
        $this->log($request, 'scenario.created', 'scenario', $scenario->title);

        return redirect()->route('admin.scenarios.edit', $scenario)->with('success', 'Scénario enregistré en brouillon.');
    }

    public function update(Request $request, ScenarioDefinition $scenario, ScenarioValidator $validator): RedirectResponse
    {
        if ($scenario->source === 'builtin') {
            $data = $request->validate(['title' => ['required', 'string', 'max:190'], 'description' => ['nullable', 'string', 'max:1000']]);
            $scenario->update($data);
        } else {
            $this->saveCustom($request, $scenario, $validator);
        }
        $this->log($request, 'scenario.updated', 'scenario', $scenario->title);

        return back()->with('success', 'Scénario enregistré.');
    }

    public function publication(Request $request, ScenarioDefinition $scenario, ScenarioValidator $validator): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['draft', 'published'])]]);
        if ($data['status'] === 'published' && $scenario->source === 'custom') {
            $errors = $validator->validate($scenario->definition);
            if ($errors !== []) {
                return back()->with('error', 'Publication impossible : le scénario contient '.count($errors).' erreur(s). Corrige-les puis réessaie.');
            }
        }
        $scenario->update(['status_publication' => $data['status'], 'validated_at' => $data['status'] === 'published' ? now() : $scenario->validated_at]);
        $this->log($request, $data['status'] === 'published' ? 'scenario.published' : 'scenario.unpublished', 'scenario', $scenario->title);

        return back()->with('success', $data['status'] === 'published' ? 'Scénario publié : il est disponible pour les étudiants.' : 'Scénario retiré : les TP qui l’utilisent ne sont plus accessibles.');
    }

    public function destroy(Request $request, ScenarioDefinition $scenario): RedirectResponse
    {
        abort_if($scenario->source === 'builtin', 422, 'Un scénario intégré ne peut pas être supprimé (il peut être dépublié).');
        if (Lesson::where('scenario_key', $scenario->key)->exists() || Protocol::where('scenario_key', $scenario->key)->exists()) {
            return back()->with('error', 'Ce scénario est utilisé par un chapitre ou une fiche : retire-le d’abord.');
        }
        $scenario->delete();
        $this->log($request, 'scenario.deleted', 'scenario', $scenario->title);

        return redirect()->route('admin.scenarios.index')->with('success', 'Scénario supprimé.');
    }

    private function saveCustom(Request $request, ScenarioDefinition $scenario, ScenarioValidator $validator): void
    {
        $data = $request->validate([
            'key' => [...$this->slugRule(), Rule::unique('scenario_definitions', 'key')->ignore($scenario->id)],
            'title' => ['required', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:1000'],
            'definition' => ['required', 'string', 'max:400000', 'json'],
        ]);
        $definition = json_decode($data['definition'], true);
        $errors = $validator->validate($definition);
        // Un brouillon peut être enregistré incomplet ; il ne pourra être publié qu'une fois valide.
        if ($errors !== [] && $scenario->isPublished()) {
            throw ValidationException::withMessages(['definition' => $errors]);
        }
        if ($scenario->exists && $scenario->key !== $data['key'] && Lesson::where('scenario_key', $scenario->key)->exists()) {
            throw ValidationException::withMessages(['key' => 'Identifiant utilisé par un chapitre : il ne peut plus être modifié.']);
        }
        $scenario->fill([
            'key' => $data['key'], 'title' => $data['title'], 'description' => $data['description'] ?? null,
            'definition' => $definition, 'updated_by' => $request->user()->id,
            'validated_at' => $errors === [] ? now() : null,
        ])->save();
        if ($errors !== []) {
            session()->flash('error', 'Brouillon enregistré avec '.count($errors).' erreur(s) à corriger avant publication.');
        }
    }
}
