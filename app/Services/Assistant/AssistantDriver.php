<?php

namespace App\Services\Assistant;

/** Pilote d'un fournisseur d'IA générative (appel côté serveur uniquement). */
interface AssistantDriver
{
    /**
     * @param  list<array{role: 'user'|'assistant', content: string}>  $messages
     *
     * @throws AssistantUnavailable
     */
    public function complete(string $system, array $messages): string;
}
