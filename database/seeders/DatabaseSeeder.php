<?php

namespace Database\Seeders;

use App\Services\Content\ContentImporter;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Importe le contenu pédagogique (protocoles, termes, couches, leçons,
     * quiz, diagnostics) depuis database/content. Équivaut à `php artisan netlab:content`.
     */
    public function run(ContentImporter $importer): void
    {
        $counts = $importer->import();
        $this->command?->info('Contenu pédagogique importé : '.collect($counts)->map(fn ($n, $type) => "{$n} {$type}")->implode(', '));
    }
}
