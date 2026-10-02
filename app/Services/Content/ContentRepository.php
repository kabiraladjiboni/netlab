<?php

namespace App\Services\Content;

use JsonException;
use RuntimeException;

/** Lecture des fichiers de contenu JSON (database/content). */
class ContentRepository
{
    public function __construct(private readonly string $basePath) {}

    /** @return list<array<string, mixed>> */
    public function read(string $file): array
    {
        $path = $this->basePath.DIRECTORY_SEPARATOR.$file;
        if (! is_file($path)) {
            throw new RuntimeException("Fichier de contenu introuvable : {$file}");
        }

        try {
            $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException("JSON invalide dans {$file} : {$exception->getMessage()}", 0, $exception);
        }

        if (! is_array($data) || ! array_is_list($data)) {
            throw new RuntimeException("{$file} doit contenir une liste JSON.");
        }

        return $data;
    }

    /** @return list<array<string, mixed>> */
    public function readDirectory(string $directory): array
    {
        $files = glob($this->basePath.DIRECTORY_SEPARATOR.$directory.DIRECTORY_SEPARATOR.'*.json') ?: [];
        sort($files);
        $items = [];
        foreach ($files as $file) {
            array_push($items, ...$this->read($directory.DIRECTORY_SEPARATOR.basename($file)));
        }

        return $items;
    }
}
