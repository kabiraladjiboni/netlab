<?php

namespace App\Support;

use Illuminate\Support\Str;

class Text
{
    /** Minuscules, sans accents, espaces normalisés : utilisé pour la recherche. */
    public static function normalize(?string $value): string
    {
        $value = Str::ascii((string) $value);
        $value = mb_strtolower($value);

        return trim((string) preg_replace('/\s+/', ' ', $value));
    }

    public static function searchable(string ...$parts): string
    {
        return ' '.self::normalize(implode(' ', $parts)).' ';
    }

    /** Retire la mini-syntaxe des contenus ([[terme|libellé]], **gras**, `code`). */
    public static function plain(string $value): string
    {
        $value = (string) preg_replace('/\[\[[a-z0-9-]+\|([^\]]+)\]\]/', '$1', $value);
        $value = (string) preg_replace('/\[\[([a-z0-9-]+)\]\]/', '$1', $value);
        $value = (string) preg_replace('/\*\*([^*]+)\*\*/', '$1', $value);

        return (string) preg_replace('/`([^`]+)`/', '$1', $value);
    }
}
