<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Platform\AdminLogger;
use Illuminate\Http\Request;

abstract class AdminController extends Controller
{
    protected function log(Request $request, string $action, ?string $type = null, ?string $label = null, array $details = []): void
    {
        app(AdminLogger::class)->log($request->user(), $action, $type, $label, $details);
        // Actions sensibles sur les comptes et les réglages : aussi dans le journal de sécurité.
        if (str_starts_with($action, 'user.') || str_starts_with($action, 'settings.') || str_starts_with($action, 'export.')) {
            \App\Support\Security\SecurityLog::record('admin.'.$action, $request->user(), $request, ['target' => $type === 'user' ? 'compte' : $type], 'notice');
        }
    }

    /** Contrôle commun des slugs saisis dans l'administration. */
    protected function slugRule(): array
    {
        return ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'];
    }

    /** Transforme un texte « un élément par ligne » en liste propre. */
    protected function lines(?string $text): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\r?\n/', (string) $text)), fn ($line) => $line !== ''));
    }

    /** Décode un champ JSON saisi dans un formulaire (déjà validé avec la règle « json »). */
    protected function json(?string $text, mixed $default = []): mixed
    {
        if ($text === null || trim($text) === '') {
            return $default;
        }

        return json_decode($text, true);
    }
}
