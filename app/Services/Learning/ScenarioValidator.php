<?php

namespace App\Services\Learning;

/**
 * Validation serveur d'un scénario personnalisé (même règles que
 * resources/js/engine/validate.ts, plus un contrôle de structure).
 * Le scénario est une DONNÉE : aucun code n'est jamais exécuté.
 */
class ScenarioValidator
{
    private const NODE_KINDS = ['laptop', 'desktop', 'phone', 'box', 'router', 'switch', 'server', 'dns', 'firewall', 'ap', 'cloud', 'ont', 'tower', 'iot', 'loadbalancer'];

    private const ZONE_TONES = ['home', 'isp', 'internet', 'datacenter', 'lan', 'vlan-a', 'vlan-b', 'dns'];

    private const MEDIA = ['ethernet', 'wifi', 'fiber', 'wan', 'trunk', 'logical', 'radio'];

    private const PACKET_TONES = ['request', 'response', 'control', 'secure', 'broadcast', 'error'];

    private const STATUSES = ['info', 'ok', 'warning', 'error'];

    private const FIELD_LAYERS = ['link', 'network', 'transport', 'security', 'app'];

    /** @var list<string> */
    private array $errors = [];

    /** @return list<string> erreurs (liste vide si le scénario est valide) */
    public function validate(mixed $scenario): array
    {
        $this->errors = [];
        if (! is_array($scenario)) {
            return ['Le scénario doit être un objet JSON.'];
        }
        if (strlen(json_encode($scenario)) > 400_000) {
            return ['Scénario trop volumineux (400 Ko maximum).'];
        }

        foreach (['id', 'title', 'summary'] as $key) {
            $this->string($scenario[$key] ?? null, $key, 300, true);
        }
        if (! is_array($scenario['assumptions'] ?? null)) {
            $this->errors[] = 'assumptions : liste attendue (hypothèses et simplifications).';
        }
        $w = $scenario['viewBox']['w'] ?? null;
        $h = $scenario['viewBox']['h'] ?? null;
        if (! is_numeric($w) || ! is_numeric($h) || $w < 200 || $h < 150 || $w > 3000 || $h > 3000) {
            $this->errors[] = 'viewBox : largeur et hauteur entre 200 et 3000.';
            $w = $h = 0;
        }

        $nodes = [];
        foreach ($this->list($scenario['nodes'] ?? null, 'nodes', 40) as $i => $node) {
            $where = 'nœud '.($i + 1);
            $id = $this->string($node['id'] ?? null, "{$where}.id", 60, true);
            if ($id !== null && isset($nodes[$id])) {
                $this->errors[] = "Nœud dupliqué : {$id}";
            }
            $this->enum($node['kind'] ?? null, self::NODE_KINDS, "{$where}.kind");
            $this->string($node['label'] ?? null, "{$where}.label", 80, true);
            if (! is_numeric($node['x'] ?? null) || ! is_numeric($node['y'] ?? null) || $node['x'] < 0 || $node['y'] < 0 || $node['x'] > $w || $node['y'] > $h) {
                $this->errors[] = "Nœud hors scène : ".($id ?? $where);
            }
            $this->levelText($node['description'] ?? null, "{$where}.description");
            if ($id !== null) {
                $nodes[$id] = true;
            }
        }

        foreach ($this->list($scenario['zones'] ?? [], 'zones', 20, false) as $i => $zone) {
            $this->string($zone['label'] ?? null, 'zone '.($i + 1).'.label', 60, true);
            $this->enum($zone['tone'] ?? null, self::ZONE_TONES, 'zone '.($i + 1).'.tone');
        }

        $links = [];
        foreach ($this->list($scenario['links'] ?? null, 'links', 80) as $link) {
            $from = $link['from'] ?? null;
            $to = $link['to'] ?? null;
            foreach ([$from, $to] as $end) {
                if (! is_string($end) || ! isset($nodes[$end])) {
                    $this->errors[] = 'Lien vers un nœud inconnu : '.json_encode($end);
                }
            }
            if (isset($link['medium'])) {
                $this->enum($link['medium'], self::MEDIA, 'links.medium');
            }
            if (is_string($from) && is_string($to)) {
                $links[$this->linkKey($from, $to)] = true;
            }
        }

        $packets = is_array($scenario['packets'] ?? null) ? $scenario['packets'] : [];
        foreach ($packets as $id => $details) {
            if (! is_array($details) || ($details['id'] ?? null) !== $id) {
                $this->errors[] = "Détails de paquet mal indexés : {$id}";

                continue;
            }
            $this->string($details['title'] ?? null, "paquet {$id}.title", 190, true);
            $this->string($details['protocol'] ?? null, "paquet {$id}.protocol", 60, true);
            foreach (['who', 'to', 'why', 'next'] as $key) {
                $this->string($details['beginner'][$key] ?? null, "paquet {$id}.beginner.{$key}", 600, true);
            }
            foreach ($this->list($details['layers'] ?? [], "paquet {$id}.layers", 10, false) as $layer) {
                $this->enum($layer['layer'] ?? null, self::FIELD_LAYERS, "paquet {$id}.layers.layer");
                foreach ($this->list($layer['fields'] ?? [], "paquet {$id}.fields", 40, false) as $field) {
                    if (! in_array($field['level'] ?? null, [2, 3], true)) {
                        $this->errors[] = "paquet {$id} : chaque champ doit avoir un niveau 2 ou 3.";
                    }
                }
            }
        }

        $steps = $this->list($scenario['steps'] ?? null, 'steps', 60);
        if ($steps === []) {
            $this->errors[] = 'Le scénario ne contient aucune étape.';
        }
        $stepIds = [];
        foreach ($steps as $index => $step) {
            $where = 'étape '.($index + 1);
            $id = $this->string($step['id'] ?? null, "{$where}.id", 60, true);
            if ($id !== null && isset($stepIds[$id])) {
                $this->errors[] = "Identifiant d'étape dupliqué : {$id}";
            }
            $stepIds[(string) $id] = true;
            $this->string($step['title'] ?? null, "{$where}.title", 190, true);
            $this->levelText($step['text'] ?? null, "{$where}.text");
            if (isset($step['status'])) {
                $this->enum($step['status'], self::STATUSES, "{$where}.status");
            }
            foreach ((array) ($step['focus'] ?? []) as $focus) {
                if (! is_string($focus) || ! isset($nodes[$focus])) {
                    $this->errors[] = "{$where} : focus sur un nœud inconnu ".json_encode($focus);
                }
            }
            if (isset($step['details']) && ! isset($packets[$step['details']])) {
                $this->errors[] = "{$where} : détails de paquet inconnus {$step['details']}";
            }
            if (isset($step['bubble']) && ! isset($nodes[$step['bubble']['node'] ?? ''])) {
                $this->errors[] = "{$where} : bulle sur un nœud inconnu";
            }
            $seen = [];
            foreach ($this->list($step['packets'] ?? [], "{$where}.packets", 20, false) as $packet) {
                $pid = $packet['id'] ?? '?';
                $this->enum($packet['tone'] ?? null, self::PACKET_TONES, "{$where} paquet {$pid}.tone");
                $path = is_array($packet['path'] ?? null) ? array_values($packet['path']) : [];
                if (count($path) < 2) {
                    $this->errors[] = "{$where} : le paquet {$pid} n'a pas de trajet";
                }
                foreach ($path as $i => $node) {
                    if (! is_string($node) || ! isset($nodes[$node])) {
                        $this->errors[] = "{$where} : paquet {$pid} → nœud inconnu ".json_encode($node);
                    } elseif ($i > 0 && is_string($path[$i - 1]) && ! isset($links[$this->linkKey($path[$i - 1], $node)])) {
                        $this->errors[] = "{$where} : paquet {$pid} emprunte un lien absent {$path[$i - 1]} → {$node}";
                    }
                }
                if (isset($packet['after']) && ! isset($seen[$packet['after']])) {
                    $this->errors[] = "{$where} : le paquet {$pid} attend {$packet['after']}, qui n'est pas défini avant lui";
                }
                if (isset($packet['inspect']) && ! isset($packets[$packet['inspect']])) {
                    $this->errors[] = "{$where} : le paquet {$pid} référence des détails inconnus {$packet['inspect']}";
                }
                $seen[$pid] = true;
            }
        }

        return array_values(array_unique($this->errors));
    }

    private function linkKey(string $a, string $b): string
    {
        $pair = [$a, $b];
        sort($pair);

        return implode('↔', $pair);
    }

    /** @return list<array<string, mixed>> */
    private function list(mixed $value, string $where, int $max, bool $required = true): array
    {
        if ($value === null && ! $required) {
            return [];
        }
        if (! is_array($value) || ! array_is_list($value)) {
            $this->errors[] = "{$where} : liste attendue.";

            return [];
        }
        if (count($value) > $max) {
            $this->errors[] = "{$where} : {$max} éléments maximum.";
        }

        return array_values(array_filter($value, 'is_array'));
    }

    private function string(mixed $value, string $where, int $max, bool $required): ?string
    {
        if (! is_string($value) || ($required && trim($value) === '')) {
            if ($required) {
                $this->errors[] = "{$where} : texte obligatoire.";
            }

            return null;
        }
        if (mb_strlen($value) > $max) {
            $this->errors[] = "{$where} : {$max} caractères maximum.";
        }

        return $value;
    }

    private function enum(mixed $value, array $allowed, string $where): void
    {
        if (! in_array($value, $allowed, true)) {
            $this->errors[] = "{$where} : valeur inconnue ".json_encode($value).' (attendu : '.implode(', ', $allowed).').';
        }
    }

    private function levelText(mixed $value, string $where): void
    {
        if (is_string($value) && trim($value) !== '') {
            return;
        }
        if (is_array($value) && is_string($value['1'] ?? $value[1] ?? null) && trim($value['1'] ?? $value[1]) !== '') {
            return;
        }
        $this->errors[] = "{$where} : texte obligatoire (chaîne ou objet {\"1\": …, \"2\": …, \"3\": …}).";
    }
}
