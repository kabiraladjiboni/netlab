<?php

namespace App\Http\Controllers\Admin;

use App\Models\FeedbackReport;
use App\Services\Learning\ContentResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Retours et signalements des étudiants (jamais publiés automatiquement). */
class FeedbackController extends AdminController
{
    public function index(Request $request, ContentResolver $resolver): Response
    {
        $filters = $request->validate([
            'statut' => ['nullable', Rule::in(array_keys(FeedbackReport::STATUSES))],
            'categorie' => ['nullable', Rule::in(array_keys(FeedbackReport::CATEGORIES))],
            'priorite' => ['nullable', Rule::in(array_keys(FeedbackReport::PRIORITIES))],
        ]);
        $reports = FeedbackReport::with(['user:id,name', 'handler:id,name'])
            ->when($filters['statut'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['categorie'] ?? null, fn ($q, $v) => $q->where('category', $v))
            ->when($filters['priorite'] ?? null, fn ($q, $v) => $q->where('priority', $v))
            ->orderByRaw("CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END")
            ->orderByRaw("CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END")
            ->latest()->paginate(20)->withQueryString();
        $describe = $resolver->describe($reports->getCollection()->filter(fn ($r) => $r->subject_type && $r->subject_slug)->map(fn ($r) => [$r->subject_type, $r->subject_slug]));

        return Inertia::render('admin/feedback/index', [
            'reports' => $reports->through(fn (FeedbackReport $r) => [
                'id' => $r->id, 'category' => $r->category, 'message' => $r->message, 'status' => $r->status, 'priority' => $r->priority,
                'admin_note' => $r->admin_note, 'page_url' => $r->page_url,
                'subject' => $r->subject_type ? ($describe["{$r->subject_type}:{$r->subject_slug}"] ?? ['title' => $r->subject_slug, 'href' => null]) : null,
                'author' => $r->user?->name ?? 'Compte supprimé', 'author_id' => $r->user_id, 'handler' => $r->handler?->name,
                'created_at' => $r->created_at->toIso8601String(), 'resolved_at' => $r->resolved_at?->toIso8601String(),
            ]),
            'filters' => $filters,
            'categories' => FeedbackReport::CATEGORIES,
            'statuses' => FeedbackReport::STATUSES,
            'priorities' => FeedbackReport::PRIORITIES,
            'counts' => FeedbackReport::selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]);
    }

    public function update(Request $request, FeedbackReport $report): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(FeedbackReport::STATUSES))],
            'priority' => ['required', Rule::in(array_keys(FeedbackReport::PRIORITIES))],
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ]);
        $resolved = in_array($data['status'], ['resolved', 'closed'], true);
        $report->fill([
            ...$data,
            'handled_by' => $request->user()->id,
            'resolved_at' => $resolved ? ($report->resolved_at ?? now()) : null,
        ])->save();
        $this->log($request, 'feedback.updated', 'feedback', '#'.$report->id, ['statut' => $data['status']]);

        return back()->with('success', 'Retour mis à jour.');
    }
}
