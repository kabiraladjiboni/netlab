<?php

namespace App\Services\Content;

use App\Models\NetworkLayer;
use App\Models\Protocol;
use App\Models\Quiz;

/**
 * Génère un petit quiz à partir des données VALIDÉES d'une fiche protocole
 * (ports, couches, statut, problème résolu). Aucune information n'est
 * inventée : chaque question et chaque mauvaise réponse proviennent du
 * catalogue. Le tirage est déterministe (graine = identifiant de la fiche).
 */
class QuizGenerator
{
    private const STATUS_LABELS = [
        'standard' => 'un protocole normalisé (standard ouvert)',
        'mechanism' => 'un mécanisme (pas un protocole échangé entre machines)',
        'tool' => 'un outil de diagnostic',
        'proprietary' => 'un protocole propriétaire',
        'certification' => 'une certification de sécurité',
        'open-source' => 'un protocole ouvert issu d’un projet libre, non normalisé par l’IETF',
    ];

    /** @return array<string, mixed> */
    public function forProtocol(Protocol $protocol): array
    {
        $curated = Quiz::where('slug', 'protocole-'.$protocol->slug)->first();
        if ($curated) {
            return $curated->toPayload();
        }

        $seed = crc32($protocol->slug);
        $others = Protocol::where('id', '!=', $protocol->id)->orderBy('slug')->get();
        $questions = [];

        // 1. Problème résolu (distracteurs pris dans d'autres fiches de la même famille si possible).
        $sameCategory = $others->where('protocol_category_id', $protocol->protocol_category_id)->values();
        $pool = ($sameCategory->count() >= 3 ? $sameCategory : $others)->pluck('problem')->unique()->values()->all();
        $distractors = $this->pick($pool, 3, $seed);
        [$options, $answer] = $this->shuffle([$protocol->problem, ...$distractors], 0, $seed + 1);
        $questions[] = [
            'id' => 'g1', 'type' => 'single',
            'prompt' => "Quel problème {$protocol->acronym} permet-il de résoudre ?",
            'options' => $options, 'answer' => $answer,
            'explanation' => "{$protocol->acronym} : {$protocol->summary}",
        ];

        // 2. Port, seulement s'il existe une valeur numérique précise.
        $port = collect($protocol->ports)->first(fn ($p) => ctype_digit((string) $p['number']));
        if ($port) {
            $ownPorts = collect($protocol->ports)->pluck('number')->all();
            $portPool = $others->flatMap(fn (Protocol $other) => collect($other->ports)->pluck('number'))
                ->filter(fn ($number) => ctype_digit((string) $number) && ! in_array($number, $ownPorts, true))
                ->unique()->values()->all();
            $distractors = $this->pick($portPool, 3, $seed + 2);
            [$options, $answer] = $this->shuffle([$port['number'], ...$distractors], 0, $seed + 3);
            $questions[] = [
                'id' => 'g2', 'type' => 'single',
                'prompt' => "Quel numéro de port est associé à {$protocol->acronym} ({$port['transport']}) ?",
                'options' => array_map(fn ($value) => "Port {$value}", $options), 'answer' => $answer,
                'explanation' => 'Ports de la fiche : '.collect($protocol->ports)->map(fn ($p) => "{$p['number']}/{$p['transport']}".(isset($p['note']) ? " ({$p['note']})" : ''))->implode(', ').'.',
            ];
        }

        // 3. Couches TCP/IP.
        $layers = $protocol->layers->where('model', 'tcpip');
        if ($layers->isNotEmpty()) {
            $all = NetworkLayer::where('model', 'tcpip')->orderBy('number')->get();
            $questions[] = [
                'id' => 'g3', 'type' => 'multiple',
                'prompt' => "À quelle(s) couche(s) du modèle TCP/IP {$protocol->acronym} est-il rattaché ?",
                'options' => $all->map(fn (NetworkLayer $layer) => "{$layer->number}. {$layer->name}")->values()->all(),
                'answer' => $all->values()->keys()->filter(fn ($index) => $layers->contains('id', $all[$index]->id))->values()->all(),
                'explanation' => $protocol->tcpip_note ?: 'Voir le positionnement indiqué dans la fiche.',
            ];
        }

        // 4. Nature de la fiche.
        $statuses = array_keys(self::STATUS_LABELS);
        $wrong = $this->pick(array_values(array_diff($statuses, [$protocol->status])), 3, $seed + 4);
        [$options, $answer] = $this->shuffle([$protocol->status, ...$wrong], 0, $seed + 5);
        $questions[] = [
            'id' => 'g4', 'type' => 'single',
            'prompt' => "Comment qualifier {$protocol->acronym} ?",
            'options' => array_map(fn ($status) => ucfirst(self::STATUS_LABELS[$status]), $options), 'answer' => $answer,
            'explanation' => 'La plateforme distingue les standards ouverts, les mécanismes, les outils, les protocoles propriétaires et les certifications : une même famille peut contenir les cinq.',
        ];

        return [
            'slug' => 'protocole-'.$protocol->slug,
            'title' => "Quiz — {$protocol->acronym}",
            'description' => 'Questions générées automatiquement à partir des informations vérifiées de la fiche.',
            'questions' => $questions,
        ];
    }

    /**
     * @param  list<mixed>  $pool
     * @return list<mixed>
     */
    private function pick(array $pool, int $count, int $seed): array
    {
        mt_srand($seed);
        shuffle($pool);
        mt_srand();

        return array_slice($pool, 0, $count);
    }

    /**
     * @param  list<mixed>  $items
     * @return array{0: list<mixed>, 1: int}
     */
    private function shuffle(array $items, int $correctIndex, int $seed): array
    {
        $correct = $items[$correctIndex];
        mt_srand($seed);
        shuffle($items);
        mt_srand();

        return [$items, array_search($correct, $items, true)];
    }
}
