<?php

namespace App\Services\Learning;

use App\Models\Diagnostic;
use App\Models\Lesson;
use App\Models\Protocol;
use App\Models\Quiz;
use Illuminate\Support\Collection;

/**
 * Retrouve un contenu à partir de son type et de son identifiant (slug),
 * pour les favoris, évaluations, retours et historiques.
 */
class ContentResolver
{
    public const TYPES = ['lesson', 'protocol', 'lab', 'diagnostic', 'quiz'];

    public function exists(string $type, string $slug): bool
    {
        return match ($type) {
            'lesson' => Lesson::query()->published()->where('slug', $slug)->exists(),
            'lab' => Lesson::query()->published()->where('slug', $slug)->where('kind', 'scenario')->exists(),
            'protocol' => Protocol::query()->published()->where('slug', $slug)->exists(),
            'diagnostic' => Diagnostic::query()->published()->where('slug', $slug)->exists(),
            'quiz' => Quiz::query()->published()->where('slug', $slug)->exists(),
            default => false,
        };
    }

    /**
     * @param  iterable<array{0: string, 1: string}>  $items  paires [type, slug]
     * @return array<string, array{title: string, href: string|null, exists: bool}> clé "type:slug"
     */
    public function describe(iterable $items): array
    {
        $byType = collect($items)->groupBy(0)->map(fn (Collection $pairs) => $pairs->pluck(1)->unique()->values());
        $out = [];

        $lessonSlugs = $byType->get('lesson', collect())->merge($byType->get('lab', collect()))->unique();
        if ($lessonSlugs->isNotEmpty()) {
            $lessons = Lesson::query()->whereIn('slug', $lessonSlugs)->get()->keyBy('slug');
            foreach ($byType->get('lesson', collect()) as $slug) {
                $lesson = $lessons->get($slug);
                $out["lesson:{$slug}"] = ['title' => $lesson?->title ?? $slug, 'href' => $lesson?->href, 'exists' => $lesson !== null];
            }
            foreach ($byType->get('lab', collect()) as $slug) {
                $lesson = $lessons->get($slug);
                $out["lab:{$slug}"] = ['title' => $lesson?->title ?? $slug, 'href' => $lesson ? "/laboratoire/{$slug}" : null, 'exists' => $lesson !== null];
            }
        }
        foreach ([
            'protocol' => [Protocol::class, fn ($item) => "{$item->acronym} — {$item->name}", fn ($slug) => "/protocoles/{$slug}"],
            'diagnostic' => [Diagnostic::class, fn ($item) => $item->title, fn ($slug) => "/diagnostic/{$slug}"],
            'quiz' => [Quiz::class, fn ($item) => $item->title, fn ($slug) => "/quiz/{$slug}"],
        ] as $type => [$model, $title, $href]) {
            $slugs = $byType->get($type);
            if ($slugs === null) {
                continue;
            }
            $found = $model::query()->whereIn('slug', $slugs)->get()->keyBy('slug');
            foreach ($slugs as $slug) {
                $item = $found->get($slug);
                $out["{$type}:{$slug}"] = ['title' => $item ? $title($item) : $slug, 'href' => $item ? $href($slug) : null, 'exists' => $item !== null];
            }
        }

        return $out;
    }
}
