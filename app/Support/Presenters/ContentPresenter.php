<?php

namespace App\Support\Presenters;

use App\Models\Equipment;
use App\Models\Lesson;
use App\Models\NetworkLayer;
use App\Models\NetworkType;
use App\Models\Protocol;
use App\Models\ProtocolRelationship;
use App\Models\TechnicalTerm;

/**
 * Transforme les modèles en tableaux destinés au frontend (props Inertia).
 * Centraliser ces formats évite de les dupliquer dans chaque contrôleur.
 */
class ContentPresenter
{
    /** @return array<string, mixed> */
    public static function protocolSummary(Protocol $protocol): array
    {
        $protocol->loadMissing(['category', 'layers']);

        return [
            'slug' => $protocol->slug,
            'acronym' => $protocol->acronym,
            'name' => $protocol->name,
            'summary' => $protocol->summary,
            'status' => $protocol->status,
            'completeness' => $protocol->completeness,
            'category' => $protocol->category ? ['slug' => $protocol->category->slug, 'name' => $protocol->category->name] : null,
            'layers' => $protocol->layers->map(fn (NetworkLayer $layer) => [
                'model' => $layer->model, 'number' => $layer->number, 'slug' => $layer->slug, 'name' => $layer->name,
            ])->values(),
            'ports' => $protocol->ports,
        ];
    }

    /** @return array<string, mixed> */
    public static function protocolDetail(Protocol $protocol): array
    {
        $protocol->loadMissing(['relationships.related', 'terms']);
        $lesson = $protocol->lesson_slug ? Lesson::published()->where('slug', $protocol->lesson_slug)->first() : null;

        return [
            ...self::protocolSummary($protocol),
            'problem' => $protocol->problem,
            'beginner' => $protocol->beginner,
            'analogy' => $protocol->analogy,
            'real_example' => $protocol->real_example,
            'osi_note' => $protocol->osi_note,
            'tcpip_note' => $protocol->tcpip_note,
            'communication' => $protocol->communication,
            'fields' => $protocol->fields,
            'packet_example' => $protocol->packet_example,
            'mistakes' => $protocol->mistakes,
            'limits' => $protocol->limits,
            'variants' => $protocol->variants,
            'references' => $protocol->references,
            'scenario' => $protocol->scenario_key,
            'lesson' => $lesson ? ['slug' => $lesson->slug, 'title' => $lesson->title, 'href' => $lesson->href] : null,
            'related' => $protocol->relationships
                ->filter(fn (ProtocolRelationship $relation) => $relation->related?->isPublished())
                ->sortBy(fn (ProtocolRelationship $relation) => array_search($relation->type, array_keys(ProtocolRelationship::TYPES), true))
                ->map(fn (ProtocolRelationship $relation) => [
                    'slug' => $relation->related->slug,
                    'acronym' => $relation->related->acronym,
                    'name' => $relation->related->name,
                    'type' => $relation->type,
                    'type_label' => ProtocolRelationship::TYPES[$relation->type] ?? $relation->type,
                    'note' => $relation->note,
                ])->values(),
            'terms' => $protocol->terms->filter(fn (TechnicalTerm $term) => $term->isPublished())->map(fn (TechnicalTerm $term) => ['slug' => $term->slug, 'term' => $term->term])->values(),
        ];
    }

    /** @return array<string, mixed> */
    public static function layer(NetworkLayer $layer): array
    {
        $layer->loadMissing('protocols');

        return [
            'slug' => $layer->slug,
            'model' => $layer->model,
            'number' => $layer->number,
            'name' => $layer->name,
            'english' => $layer->english,
            'role' => $layer->role,
            'problem' => $layer->problem,
            'examples' => $layer->examples,
            'devices' => $layer->devices,
            'pdu' => $layer->pdu,
            'neighbors' => $layer->neighbors,
            'note' => $layer->note,
            'maps_to' => $layer->maps_to,
            'protocols' => $layer->protocols->map(fn (Protocol $protocol) => ['slug' => $protocol->slug, 'acronym' => $protocol->acronym])->values(),
        ];
    }

    /** @return array<string, mixed> */
    public static function networkType(NetworkType $type): array
    {
        return $type->only(['slug', 'acronym', 'name', 'dimension', 'definition', 'objective', 'example', 'technologies', 'scope', 'relations', 'illustration']);
    }

    /** @return array<string, mixed> */
    public static function equipment(Equipment $equipment): array
    {
        $equipment->loadMissing('protocols');

        return [
            ...$equipment->only(['slug', 'name', 'icon', 'category', 'function', 'problems', 'examines', 'placement', 'confusions', 'layers']),
            'protocols' => $equipment->protocols->map(fn (Protocol $protocol) => ['slug' => $protocol->slug, 'acronym' => $protocol->acronym])->values(),
        ];
    }
}
