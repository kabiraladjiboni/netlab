<?php

namespace App\Http\Controllers\Admin;

use App\Models\Diagnostic;
use App\Models\LabSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DiagnosticController extends AdminController
{
    public function index(): Response
    {
        $stats = LabSession::where('lab_type', 'diagnostic')->selectRaw("lab_slug, COUNT(*) as n, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as solved")->groupBy('lab_slug')->get()->keyBy('lab_slug');

        return Inertia::render('admin/diagnostics/index', [
            'diagnostics' => Diagnostic::orderBy('sort')->get()->map(fn (Diagnostic $d) => [
                'id' => $d->id, 'slug' => $d->slug, 'title' => $d->title, 'difficulty' => $d->difficulty, 'status' => $d->status_publication,
                'sessions' => (int) ($stats[$d->slug]->n ?? 0), 'solved' => (int) ($stats[$d->slug]->solved ?? 0),
            ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/diagnostics/edit', ['diagnostic' => null]);
    }

    public function edit(Diagnostic $diagnostic): Response
    {
        return Inertia::render('admin/diagnostics/edit', [
            'diagnostic' => [
                ...$diagnostic->only(['id', 'slug', 'title', 'difficulty', 'summary', 'symptoms', 'observations', 'hints', 'choices', 'answer', 'explanation', 'status_publication']),
                'related' => $diagnostic->related ?? [],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $diagnostic = new Diagnostic;
        $this->save($request, $diagnostic);
        $this->log($request, 'diagnostic.created', 'diagnostic', $diagnostic->title);

        return redirect()->route('admin.diagnostics.edit', $diagnostic)->with('success', 'Exercice créé.');
    }

    public function update(Request $request, Diagnostic $diagnostic): RedirectResponse
    {
        $this->save($request, $diagnostic);
        $this->log($request, 'diagnostic.updated', 'diagnostic', $diagnostic->title, ['statut' => $diagnostic->status_publication]);

        return back()->with('success', 'Exercice enregistré.');
    }

    public function destroy(Request $request, Diagnostic $diagnostic): RedirectResponse
    {
        if (LabSession::where('lab_type', 'diagnostic')->where('lab_slug', $diagnostic->slug)->exists()) {
            return back()->with('error', 'Des étudiants ont travaillé sur cet exercice : dépublie-le plutôt.');
        }
        $diagnostic->delete();
        $this->log($request, 'diagnostic.deleted', 'diagnostic', $diagnostic->title);

        return redirect()->route('admin.diagnostics.index')->with('success', 'Exercice supprimé.');
    }

    private function save(Request $request, Diagnostic $diagnostic): void
    {
        $data = $request->validate([
            'slug' => [...$this->slugRule(), Rule::unique('diagnostics', 'slug')->ignore($diagnostic->id)],
            'title' => ['required', 'string', 'max:190'],
            'difficulty' => ['required', Rule::in(['facile', 'moyen', 'difficile'])],
            'summary' => ['required', 'string', 'max:1000'],
            'symptoms' => ['required', 'array', 'min:1', 'max:10'], 'symptoms.*' => ['string', 'max:300'],
            'observations' => ['array', 'max:10'],
            'observations.*.kind' => ['required', Rule::in(['command', 'capture', 'config', 'log', 'note'])],
            'observations.*.title' => ['required', 'string', 'max:190'],
            'observations.*.lines' => ['required', 'array', 'min:1', 'max:40'],
            'observations.*.lines.*' => ['nullable', 'string', 'max:300'],
            'hints' => ['required', 'array', 'min:1', 'max:6'], 'hints.*' => ['string', 'max:800'],
            'choices' => ['required', 'array', 'min:2', 'max:6'], 'choices.*' => ['string', 'max:400'],
            'answer' => ['required', 'integer', 'min:0'],
            'explanation' => ['required', 'string', 'max:4000'],
            'related' => ['array', 'max:8'],
            'related.*.label' => ['required', 'string', 'max:120'],
            'related.*.href' => ['required', 'string', 'max:190', 'regex:/^\/[a-z0-9\/\-?=]*$/'],
            'status_publication' => ['required', Rule::in(['draft', 'published'])],
        ]);
        if ($data['answer'] >= count($data['choices'])) {
            throw ValidationException::withMessages(['answer' => 'La bonne réponse doit faire partie des choix.']);
        }
        $observations = array_map(fn ($o) => [...$o, 'lines' => array_map(fn ($l) => (string) $l, $o['lines'])], $data['observations'] ?? []);
        $diagnostic->fill([...$data, 'related' => $data['related'] ?? [], 'observations' => $observations, 'content_updated_at' => now()]);
        if (! $diagnostic->exists) {
            $diagnostic->sort = (Diagnostic::max('sort') ?? 0) + 1;
        }
        $diagnostic->save();
    }
}
