<?php

namespace App\Services\Search;

use App\Models\Equipment;
use App\Models\Lesson;
use App\Models\NetworkLayer;
use App\Models\NetworkType;
use App\Models\Protocol;
use App\Models\TechnicalTerm;
use App\Support\Text;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Recherche globale : protocoles, termes, couches, types de réseaux,
 * équipements, leçons et pages. Les textes sont normalisés à l'import
 * (minuscules, sans accents) pour une recherche tolérante, compatible
 * SQLite et MySQL.
 */
class SearchService
{
    /** Pages statiques indexées. */
    private const PAGES = [
        ['title' => 'Modèle OSI', 'subtitle' => 'Les 7 couches, l’encapsulation et la désencapsulation', 'href' => '/modeles/osi', 'keywords' => 'osi couches modele encapsulation desencapsulation pdu'],
        ['title' => 'Modèle TCP/IP', 'subtitle' => 'Les 4 couches et la correspondance avec OSI', 'href' => '/modeles/tcp-ip', 'keywords' => 'tcp/ip tcpip modele couches internet transport application acces reseau'],
        ['title' => 'Comprendre Wireshark', 'subtitle' => 'Lire une capture, filtres, retransmissions', 'href' => '/wireshark', 'keywords' => 'wireshark capture pcap filtre paquet analyse trafic'],
        ['title' => 'Exercices de diagnostic', 'subtitle' => 'Pannes courantes et indices progressifs', 'href' => '/diagnostic', 'keywords' => 'diagnostic panne depannage exercice probleme'],
        ['title' => 'VLAN, sous-réseaux et segmentation', 'subtitle' => 'VLAN, trunk, CIDR, LAN et WAN', 'href' => '/segmentation', 'keywords' => 'vlan segmentation sous-reseau cidr masque trunk 802.1q wan lan'],
        ['title' => 'Types de réseaux', 'subtitle' => 'PAN, LAN, WLAN, CAN, MAN, WAN, SAN, VPN', 'href' => '/reseaux', 'keywords' => 'types reseaux pan lan wlan can man wan san vpn'],
        ['title' => 'Équipements réseau', 'subtitle' => 'Routeur, commutateur, box, pare-feu…', 'href' => '/equipements', 'keywords' => 'equipements materiel routeur commutateur switch box pare-feu'],
        ['title' => 'Notre histoire', 'subtitle' => 'Mission, vision et communauté Abòrò', 'href' => '/notre-histoire', 'keywords' => 'histoire mission vision aboro communaute marque a propos'],
        ['title' => 'Quiz', 'subtitle' => 'Tester ses connaissances', 'href' => '/quiz', 'keywords' => 'quiz test evaluation questions'],
    ];

    /** @return list<array{type: string, title: string, subtitle: string, href: string}> */
    public function search(string $query, int $limit = 24): array
    {
        $needle = Text::normalize($query);
        if (mb_strlen($needle) < 2) {
            return [];
        }
        $like = '%'.addcslashes($needle, '%_\\').'%';
        $words = array_values(array_filter(explode(' ', $needle), fn ($word) => mb_strlen($word) >= 2));

        $results = collect()
            ->merge($this->protocols($like, $needle, $words))
            ->merge($this->terms($like, $needle, $words))
            ->merge($this->layers($like, $needle, $words))
            ->merge($this->lessons($like, $needle, $words))
            ->merge($this->networkTypes($like, $needle, $words))
            ->merge($this->equipment($like, $needle, $words))
            ->merge($this->pages($needle, $words));

        return $results
            ->sortByDesc('score')
            ->unique('href')
            ->take($limit)
            ->map(fn (array $result) => collect($result)->except('score')->all())
            ->values()
            ->all();
    }

    /** @param list<string> $words */
    private function matching(Builder $query, string $like, array $words): Builder
    {
        return $query->where(function (Builder $builder) use ($like, $words) {
            $builder->where('search_text', 'like', $like);
            if (count($words) > 1) {
                $builder->orWhere(function (Builder $all) use ($words) {
                    foreach ($words as $word) {
                        $all->where('search_text', 'like', '%'.addcslashes($word, '%_\\').'%');
                    }
                });
            }
        });
    }

    /** Score simple : correspondance exacte du titre > début > contenu. */
    private function score(string $needle, string $title, string $text, int $weight): int
    {
        $title = Text::normalize($title);
        $score = $weight;
        if ($title === $needle) {
            $score += 100;
        } elseif (str_starts_with($title, $needle)) {
            $score += 60;
        } elseif (str_contains($title, $needle)) {
            $score += 40;
        } elseif (str_contains($text, ' '.$needle.' ')) {
            $score += 15;
        }

        return $score;
    }

    /** @param list<string> $words */
    private function protocols(string $like, string $needle, array $words): Collection
    {
        return $this->matching(Protocol::query()->published(), $like, $words)->limit(30)->get()->map(fn (Protocol $protocol) => [
            'type' => 'protocol',
            'title' => $protocol->acronym === $protocol->name ? $protocol->name : "{$protocol->acronym} — {$protocol->name}",
            'subtitle' => $protocol->summary,
            'href' => "/protocoles/{$protocol->slug}",
            'score' => max($this->score($needle, $protocol->acronym, $protocol->search_text, 30), $this->score($needle, $protocol->name, $protocol->search_text, 25)),
        ]);
    }

    /** @param list<string> $words */
    private function terms(string $like, string $needle, array $words): Collection
    {
        return $this->matching(TechnicalTerm::query()->published(), $like, $words)->limit(30)->get()->map(fn (TechnicalTerm $term) => [
            'type' => 'term',
            'title' => $term->term,
            'subtitle' => $term->simple,
            'href' => "/dictionnaire/{$term->slug}",
            'score' => max(
                $this->score($needle, $term->term, $term->search_text, 20),
                ...array_map(fn ($alias) => $this->score($needle, $alias, $term->search_text, 18), $term->aliases ?: ['']),
            ),
        ]);
    }

    /** @param list<string> $words */
    private function layers(string $like, string $needle, array $words): Collection
    {
        return $this->matching(NetworkLayer::query(), $like, $words)->get()->map(fn (NetworkLayer $layer) => [
            'type' => 'layer',
            'title' => ($layer->model === 'osi' ? 'OSI' : 'TCP/IP')." — couche {$layer->number} : {$layer->name}",
            'subtitle' => $layer->role,
            'href' => ($layer->model === 'osi' ? '/modeles/osi' : '/modeles/tcp-ip')."?couche={$layer->number}",
            'score' => $this->score($needle, $layer->name, $layer->search_text, 22),
        ]);
    }

    /** @param list<string> $words */
    private function lessons(string $like, string $needle, array $words): Collection
    {
        return $this->matching(Lesson::query()->published(), $like, $words)->get()->map(fn (Lesson $lesson) => [
            'type' => 'lesson',
            'title' => $lesson->title,
            'subtitle' => $lesson->objective,
            'href' => $lesson->href,
            'score' => $this->score($needle, $lesson->title, $lesson->search_text, 24),
        ]);
    }

    /** @param list<string> $words */
    private function networkTypes(string $like, string $needle, array $words): Collection
    {
        return $this->matching(NetworkType::query(), $like, $words)->get()->map(fn (NetworkType $type) => [
            'type' => 'network',
            'title' => $type->acronym ? "{$type->acronym} — {$type->name}" : $type->name,
            'subtitle' => $type->definition,
            'href' => "/reseaux?type={$type->slug}",
            'score' => max($this->score($needle, (string) $type->acronym, $type->search_text, 22), $this->score($needle, $type->name, $type->search_text, 20)),
        ]);
    }

    /** @param list<string> $words */
    private function equipment(string $like, string $needle, array $words): Collection
    {
        return $this->matching(Equipment::query(), $like, $words)->get()->map(fn (Equipment $equipment) => [
            'type' => 'equipment',
            'title' => $equipment->name,
            'subtitle' => $equipment->function,
            'href' => "/equipements?equipement={$equipment->slug}",
            'score' => $this->score($needle, $equipment->name, $equipment->search_text, 20),
        ]);
    }

    /** @param list<string> $words */
    private function pages(string $needle, array $words): Collection
    {
        return collect(self::PAGES)
            ->filter(function (array $page) use ($needle, $words) {
                $haystack = ' '.Text::normalize($page['title'].' '.$page['keywords']).' ';

                return str_contains($haystack, $needle) || ($words !== [] && collect($words)->every(fn ($word) => str_contains($haystack, $word)));
            })
            ->map(fn (array $page) => [
                'type' => 'page',
                'title' => $page['title'],
                'subtitle' => $page['subtitle'],
                'href' => $page['href'],
                'score' => $this->score($needle, $page['title'], $page['keywords'], 12),
            ]);
    }
}
