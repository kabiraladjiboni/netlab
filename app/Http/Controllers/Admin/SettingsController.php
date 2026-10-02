<?php

namespace App\Http\Controllers\Admin;

use App\Services\Assistant\AssistantService;
use App\Services\Platform\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Paramètres de la plateforme. Les secrets (clés d'API, mots de passe SMTP…)
 * restent dans .env : ils ne sont ni affichés ni modifiables ici.
 */
class SettingsController extends AdminController
{
    public function edit(Settings $settings): Response
    {
        $definitions = collect(Settings::DEFINITIONS)->map(fn ($def, $key) => [
            'key' => $key, 'input' => $def['input'] ?? null, 'label' => $def['label'], 'group' => $def['group'], 'help' => $def['help'] ?? null,
            'type' => in_array('boolean', $def['rules'], true) ? 'boolean' : (in_array('integer', $def['rules'], true) ? 'integer' : 'string'),
            'value' => $settings->get($key),
        ])->values();

        return Inertia::render('admin/settings', [
            'settings' => $definitions,
            'groups' => Settings::GROUPS,
            'environment' => [
                'app_env' => app()->environment(),
                'mail' => config('mail.default'),
                'ai_provider' => config('netlab.ai.provider'),
                'ai_configured' => app(AssistantService::class)->aiEnabled(),
                'geo_header' => config('netlab.geo.header'),
                'geo_ranges' => \Illuminate\Support\Facades\DB::table('geo_ip_ranges')->count(),
            ],
        ]);
    }

    public function update(Request $request, Settings $settings): RedirectResponse
    {
        $request->validate(['values' => ['required', 'array']]);
        $rules = [];
        foreach (Settings::DEFINITIONS as $key => $definition) {
            if (array_key_exists($key, $request->input('values'))) {
                $rules['values.'.str_replace('.', '\.', $key)] = $definition['rules'];
            }
        }
        $request->validate($rules);
        $values = [];
        foreach (Settings::DEFINITIONS as $key => $definition) {
            if (! array_key_exists($key, $request->input('values', []))) {
                continue;
            }
            $value = $request->input('values')[$key];
            $values[$key] = match (true) {
                in_array('boolean', $definition['rules'], true) => (bool) $value,
                in_array('integer', $definition['rules'], true) => (int) $value,
                default => $value === '' ? null : $value,
            };
        }
        $before = $settings->all();
        $settings->put($values);
        $changed = collect($values)->filter(fn ($value, $key) => ($before[$key] ?? null) !== $value)->keys()->all();
        if ($changed !== []) {
            $this->log($request, 'settings.updated', 'settings', implode(', ', $changed), collect($values)->only($changed)->all());
        }

        return back()->with('success', 'Paramètres enregistrés.');
    }

    public function logo(Request $request, Settings $settings): RedirectResponse
    {
        $request->validate(['logo' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:512', 'dimensions:max_width=2000,max_height=2000']]);
        $path = $this->storeCleanImage($request->file('logo'));
        $settings->put(['platform.logo_url' => '/storage/'.$path]);
        $this->log($request, 'settings.logo', 'settings', 'logo');

        return back()->with('success', 'Logo mis à jour. (Pense à exécuter « php artisan storage:link » si l’image ne s’affiche pas.)');
    }

    /**
     * Ré-encode l'image en PNG : supprime métadonnées et contenu caché (fichiers polyglottes),
     * sous un nom aléatoire. Sans l'extension GD, le fichier validé est conservé tel quel.
     */
    private function storeCleanImage(\Illuminate\Http\UploadedFile $file): string
    {
        if (! function_exists('imagecreatefromstring')) {
            return $file->store('branding', 'public');
        }
        $image = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if ($image === false) {
            throw \Illuminate\Validation\ValidationException::withMessages(['logo' => 'Cette image ne peut pas être lue.']);
        }
        imagealphablending($image, false);
        imagesavealpha($image, true);
        ob_start();
        imagepng($image, null, 8);
        $png = (string) ob_get_clean();
        imagedestroy($image);
        $path = 'branding/'.\Illuminate\Support\Str::random(32).'.png';
        Storage::disk('public')->put($path, $png);

        return $path;
    }
}
