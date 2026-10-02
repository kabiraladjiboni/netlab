<?php

namespace Tests;

use App\Services\Content\ContentImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /** Importer le contenu pédagogique réel avant chaque test. */
    protected bool $seedContent = true;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        if ($this->seedContent) {
            $this->app->make(ContentImporter::class)->import();
        }
    }
}
