<?php

namespace Tests\Feature;

use App\Services\Content\ContentImporter;
use App\Services\Content\ContentRepository;
use App\Services\Content\ContentValidationException;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class ContentValidationTest extends TestCase
{
    protected bool $seedContent = false;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->directory = storage_path('framework/testing/content-'.uniqid());
        File::copyDirectory(database_path('content'), $this->directory);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->directory);
        parent::tearDown();
    }

    private function importer(): ContentImporter
    {
        return new ContentImporter(new ContentRepository($this->directory));
    }

    public function test_un_protocole_lie_inconnu_est_refuse(): void
    {
        $path = $this->directory.'/protocols/03-transport.json';
        $data = json_decode(File::get($path), true);
        $data[0]['related'][] = ['slug' => 'protocole-imaginaire', 'type' => 'related'];
        File::put($path, json_encode($data));

        try {
            $this->importer()->import();
            $this->fail('Une exception était attendue.');
        } catch (ContentValidationException $exception) {
            $this->assertStringContainsString('protocole-imaginaire', implode(' ', $exception->errors));
        }
        $this->assertDatabaseCount('protocols', 0);
    }

    public function test_une_reponse_de_quiz_hors_limites_est_refusee(): void
    {
        $path = $this->directory.'/quizzes.json';
        $data = json_decode(File::get($path), true);
        $data[0]['questions'][1]['answer'] = 99;
        File::put($path, json_encode($data));

        $this->expectException(ContentValidationException::class);
        $this->importer()->import();
    }

    public function test_un_terme_inconnu_dans_une_fiche_est_refuse(): void
    {
        $path = $this->directory.'/protocols/01-liaison.json';
        $data = json_decode(File::get($path), true);
        $data[0]['terms'][] = 'terme-absent';
        File::put($path, json_encode($data));

        $this->expectException(ContentValidationException::class);
        $this->importer()->import();
    }
}
