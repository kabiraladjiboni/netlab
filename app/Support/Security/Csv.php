<?php

namespace App\Support\Security;

/**
 * Export CSV protégé contre l'injection de formules (OWASP « CSV Injection ») :
 * une cellule qui commence par = + - @ tabulation ou retour chariot est préfixée
 * d'une apostrophe, pour qu'un tableur l'affiche comme du texte au lieu de l'exécuter.
 */
final class Csv
{
    /** @param  array<int, mixed>  $row */
    public static function put($handle, array $row): void
    {
        fputcsv($handle, array_map(self::cell(...), $row), ';', '"', '\\');
    }

    public static function cell(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }
        if (is_numeric($value)) {
            return $value;
        }

        return in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$value : $value;
    }
}
