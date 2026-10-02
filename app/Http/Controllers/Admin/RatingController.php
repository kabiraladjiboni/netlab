<?php

namespace App\Http\Controllers\Admin;

use App\Models\ContentRating;
use App\Models\Favorite;
use App\Services\Learning\ContentResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Favoris et évaluations agrégés + modération des commentaires. */
class RatingController extends AdminController
{
    public function index(Request $request, ContentResolver $resolver): Response
    {
        $moderation = $request->string('moderation')->toString() ?: 'pending';
        $aggregates = ContentRating::selectRaw("subject_type, subject_slug, SUM(CASE WHEN value = 'useful' THEN 1 ELSE 0 END) as useful, SUM(CASE WHEN value = 'unclear' THEN 1 ELSE 0 END) as unclear, COUNT(comment) as comments, MAX(updated_at) as last_at")
            ->groupBy('subject_type', 'subject_slug')->get();
        $favorites = Favorite::selectRaw('subject_type, subject_slug, COUNT(*) as n')->groupBy('subject_type', 'subject_slug')->get()
            ->keyBy(fn ($f) => "{$f->subject_type}:{$f->subject_slug}");
        $keys = $aggregates->map(fn ($r) => [$r->subject_type, $r->subject_slug])->merge($favorites->map(fn ($f) => [$f->subject_type, $f->subject_slug])->values());
        $describe = $resolver->describe($keys);

        $contents = collect($describe)->map(function ($info, $key) use ($aggregates, $favorites) {
            [$type, $slug] = explode(':', $key, 2);
            $rating = $aggregates->first(fn ($r) => $r->subject_type === $type && $r->subject_slug === $slug);

            return [
                'key' => $key, 'type' => $type, 'slug' => $slug, 'title' => $info['title'], 'href' => $info['href'],
                'favorites' => (int) ($favorites[$key]->n ?? 0),
                'useful' => (int) ($rating->useful ?? 0), 'unclear' => (int) ($rating->unclear ?? 0), 'comments' => (int) ($rating->comments ?? 0),
            ];
        })->sortByDesc(fn ($c) => $c['useful'] + $c['unclear'] + $c['favorites'])->values();

        // Évolution mensuelle (12 derniers mois).
        $trend = ContentRating::where('updated_at', '>=', now()->subMonths(11)->startOfMonth())->get(['value', 'updated_at'])
            ->groupBy(fn ($r) => $r->updated_at->format('Y-m'))
            ->map(fn ($items, $month) => ['month' => $month, 'useful' => $items->where('value', 'useful')->count(), 'unclear' => $items->where('value', 'unclear')->count()])
            ->sortKeys()->values();

        $comments = ContentRating::with('user:id,name')->whereNotNull('comment')
            ->when($moderation !== 'all', fn ($q) => $q->where('comment_status', $moderation))
            ->latest('updated_at')->paginate(20)->withQueryString();
        $describeComments = $resolver->describe($comments->getCollection()->map(fn ($c) => [$c->subject_type, $c->subject_slug]));

        return Inertia::render('admin/ratings/index', [
            'contents' => $contents,
            'trend' => $trend,
            'comments' => $comments->through(fn (ContentRating $c) => [
                'id' => $c->id, 'value' => $c->value, 'comment' => $c->comment, 'status' => $c->comment_status,
                'author' => $c->user?->name, 'date' => $c->updated_at->toIso8601String(),
                'subject' => $describeComments["{$c->subject_type}:{$c->subject_slug}"] ?? ['title' => $c->subject_slug, 'href' => null],
            ]),
            'moderation' => $moderation,
            'totals' => ['useful' => ContentRating::where('value', 'useful')->count(), 'unclear' => ContentRating::where('value', 'unclear')->count(), 'favorites' => Favorite::count(), 'pending' => ContentRating::where('comment_status', 'pending')->count()],
        ]);
    }

    public function moderate(Request $request, ContentRating $rating): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['approved', 'hidden'])]]);
        $rating->forceFill(['comment_status' => $data['status']])->saveQuietly();
        $this->log($request, 'rating.moderated', 'rating', '#'.$rating->id, ['statut' => $data['status']]);

        return back()->with('success', $data['status'] === 'approved' ? 'Commentaire validé (visible uniquement par l’équipe).' : 'Commentaire masqué.');
    }
}
