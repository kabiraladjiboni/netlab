<?php

namespace App\Services\Assistant;

use App\Models\Protocol;
use App\Models\TechnicalTerm;
use App\Services\Content\ContentRepository;
use App\Support\Text;

/**
 * Base de connaissances VALIDÉE utilisée par l'assistant :
 * questions fréquentes rédigées à l'avance, dictionnaire et fiches protocoles.
 * Elle sert à la fois de mode de repli (sans IA) et de contexte fourni à l'IA.
 */
class KnowledgeBase
{
    /** @var list<array<string, mixed>>|null */
    private ?array $faq = null;

    public function __construct(private readonly ContentRepository $files) {}

    /**
     * @param  list<string>  $concepts
     * @return array{faq: array<string, mixed>|null, faq_score: int, terms: list<TechnicalTerm>, protocols: list<Protocol>}
     */
    public function retrieve(string $question, array $concepts = []): array
    {
        $normalized = ' '.Text::normalize($question).' ';
        $normalized = (string) preg_replace('/[?!.,;:«»"()]/u', ' ', $normalized);

        // Questions fréquentes : score = nombre de mots-clés trouvés (les plus longs pèsent plus).
        $best = null;
        $bestScore = 0;
        foreach ($this->faq() as $entry) {
            $score = 0;
            foreach ($entry['keywords'] as $keyword) {
                if (str_contains($normalized, Text::normalize($keyword))) {
                    $score += 10 + mb_strlen($keyword);
                }
            }
            if ($score > $bestScore) {
                $best = $entry;
                $bestScore = $score;
            }
        }

        // Termes et protocoles cités dans la question (ou dans le contexte de la page).
        $terms = TechnicalTerm::published()->get()->filter(function (TechnicalTerm $term) use ($normalized, $concepts) {
            if (in_array($term->slug, $concepts, true)) {
                return true;
            }
            foreach ([$term->term, ...($term->aliases ?? [])] as $label) {
                $label = Text::normalize($label);
                if (mb_strlen($label) >= 3 && preg_match('/(?<![a-z0-9])'.preg_quote($label, '/').'(?![a-z0-9])/u', $normalized)) {
                    return true;
                }
            }

            return false;
        })->take(4)->values()->all();

        $protocols = Protocol::published()->get()->filter(function (Protocol $protocol) use ($normalized) {
            $acronym = Text::normalize($protocol->acronym);

            return mb_strlen($acronym) >= 2 && preg_match('/(?<![a-z0-9])'.preg_quote($acronym, '/').'(?![a-z0-9])/u', $normalized);
        })->take(3)->values()->all();

        return ['faq' => $best, 'faq_score' => $bestScore, 'terms' => $terms, 'protocols' => $protocols];
    }

    /**
     * Réponse rédigée uniquement à partir du contenu validé.
     *
     * @param  array{faq: array<string, mixed>|null, faq_score: int, terms: list<TechnicalTerm>, protocols: list<Protocol>}  $found
     * @return array{answer: string, sources: list<array{label: string, href: string}>}
     */
    public function compose(array $found, int $level, ?string $excerpt): array
    {
        if ($found['faq'] && $found['faq_score'] >= 14) {
            return [
                'answer' => $found['faq']['answers'][(string) $level] ?? $found['faq']['answers']['1'],
                'sources' => $found['faq']['sources'],
            ];
        }

        $parts = [];
        $sources = [];
        foreach ($found['protocols'] as $protocol) {
            $parts[] = "**{$protocol->acronym}** — ".($level === 1 ? $protocol->beginner : $protocol->summary.' '.$protocol->problem);
            $sources[] = ['label' => "Fiche {$protocol->acronym}", 'href' => "/protocoles/{$protocol->slug}"];
        }
        foreach ($found['terms'] as $term) {
            $parts[] = "**{$term->term}** — ".($level === 1 ? $term->simple : $term->technical);
            $sources[] = ['label' => $term->term, 'href' => "/dictionnaire/{$term->slug}"];
        }

        if ($parts !== []) {
            return ['answer' => implode("\n\n", array_slice($parts, 0, 3)), 'sources' => array_slice($sources, 0, 4)];
        }

        $answer = "Je n'ai pas trouvé d'explication prédéfinie qui corresponde exactement à cette question. Essaie de la reformuler avec un mot-clé (par exemple : NAT, DNS, TCP, VLAN, adresse MAC), ou consulte le dictionnaire.";
        if ($excerpt) {
            $answer .= "\n\nRappel de l'étape en cours : ".Text::plain(mb_strimwidth($excerpt, 0, 400, '…'));
        }

        return ['answer' => $answer, 'sources' => [['label' => 'Dictionnaire', 'href' => '/dictionnaire']]];
    }

    /** @return list<array<string, mixed>> */
    private function faq(): array
    {
        return $this->faq ??= $this->files->read('faq.json');
    }
}
