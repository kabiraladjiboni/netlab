<?php

namespace App\Services\Analytics;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/** Période d'analyse choisie dans l'administration. */
final class Period
{
    public const PRESETS = ['aujourdhui' => "Aujourd'hui", '7j' => '7 derniers jours', '30j' => '30 derniers jours', '90j' => '90 derniers jours', 'perso' => 'Personnalisée'];

    private function __construct(
        public readonly string $key,
        public readonly CarbonImmutable $from,
        public readonly CarbonImmutable $to,
    ) {}

    public static function fromRequest(Request $request): self
    {
        $key = (string) $request->query('periode', '30j');
        $now = CarbonImmutable::now();

        if ($key === 'perso') {
            try {
                $from = CarbonImmutable::parse((string) $request->query('du'))->startOfDay();
                $to = CarbonImmutable::parse((string) $request->query('au'))->endOfDay();
                if ($from->lte($to) && $from->diffInDays($to) <= 400 && $to->lte($now->endOfDay())) {
                    return new self('perso', $from, $to);
                }
            } catch (\Throwable) {
                // période invalide : valeur par défaut
            }
            $key = '30j';
        }

        return match ($key) {
            'aujourdhui' => new self($key, $now->startOfDay(), $now),
            '7j' => new self($key, $now->subDays(6)->startOfDay(), $now),
            '90j' => new self($key, $now->subDays(89)->startOfDay(), $now),
            default => new self('30j', $now->subDays(29)->startOfDay(), $now),
        };
    }

    /** @return list<string> jours (Y-m-d) couverts par la période */
    public function days(): array
    {
        $days = [];
        for ($day = $this->from->startOfDay(); $day->lte($this->to); $day = $day->addDay()) {
            $days[] = $day->format('Y-m-d');
        }

        return $days;
    }

    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'label' => self::PRESETS[$this->key],
            'from' => $this->from->format('Y-m-d'),
            'to' => $this->to->format('Y-m-d'),
            'presets' => self::PRESETS,
        ];
    }
}
