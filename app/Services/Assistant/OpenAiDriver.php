<?php

namespace App\Services\Assistant;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/** API Chat Completions d'OpenAI (ou compatible). La clé reste côté serveur. */
class OpenAiDriver implements AssistantDriver
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $model,
        private readonly string $endpoint,
        private readonly int $timeout,
    ) {}

    public function complete(string $system, array $messages): string
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withToken($this->apiKey)
                ->post($this->endpoint, [
                    'model' => $this->model,
                    'max_completion_tokens' => 900,
                    'messages' => [['role' => 'system', 'content' => $system], ...$messages],
                ]);
        } catch (ConnectionException $exception) {
            throw new AssistantUnavailable('Connexion impossible au fournisseur d’IA.', 0, $exception);
        }

        if ($response->failed()) {
            throw new AssistantUnavailable("Le fournisseur d'IA a répondu {$response->status()}.");
        }

        $text = (string) $response->json('choices.0.message.content', '');
        if (trim($text) === '') {
            throw new AssistantUnavailable('Réponse vide du fournisseur d’IA.');
        }

        return $text;
    }
}
