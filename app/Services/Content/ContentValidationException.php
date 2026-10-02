<?php

namespace App\Services\Content;

use RuntimeException;

class ContentValidationException extends RuntimeException
{
    /** @param list<string> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct("Le contenu pédagogique contient des erreurs :\n- ".implode("\n- ", $errors));
    }
}
