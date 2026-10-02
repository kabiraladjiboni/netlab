<?php

namespace App\Console\Commands;

use App\Models\Protocol;
use App\Services\Content\ContentImporter;
use App\Services\Content\ContentValidationException;
use App\Services\Platform\AdminLogger;
use Illuminate\Console\Command;

class ImportContent extends Command
{
    protected $signature = 'netlab:content {--force : Remplacer le contenu existant (les modifications faites dans l\'administration seront perdues)}';

    protected $description = 'Valide puis importe le contenu pédagogique initial (database/content/*.json).';

    public function handle(ContentImporter $importer, AdminLogger $logger): int
    {
        if (Protocol::query()->exists() && ! $this->option('force')) {
            $this->warn('Du contenu existe déjà. Il se gère désormais depuis l’administration (/admin).');
            $this->line('Pour le remplacer par les fichiers JSON (modifications de l’administration perdues) : php artisan netlab:content --force');

            return self::FAILURE;
        }
        if ($this->option('force') && Protocol::query()->exists() && $this->input->isInteractive()
            && ! $this->confirm('Remplacer TOUT le contenu actuel par les fichiers JSON ?', false)) {
            return self::FAILURE;
        }

        try {
            $counts = $importer->import();
        } catch (ContentValidationException $exception) {
            $this->error('Import annulé : le contenu contient '.count($exception->errors).' erreur(s).');
            foreach ($exception->errors as $error) {
                $this->line("  • {$error}");
            }

            return self::FAILURE;
        }

        $logger->log(null, 'content.import', 'content', 'Import JSON (console)', $counts);
        $this->info('Contenu importé avec succès.');
        $this->table(['Type', 'Nombre'], collect($counts)->map(fn ($count, $type) => [$type, $count])->values()->all());

        return self::SUCCESS;
    }
}
