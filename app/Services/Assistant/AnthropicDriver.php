<?php

namespace App\Services\Assistant;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/** API Messages d'Anthropic. La clé n'est jamais transmise au navigateur. */
class AnthropicDriver implements AssistantDriver
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
                ->withHeaders(['x-api-key' => $this->apiKey, 'anthropic-version' => '2023-06-01'])
                ->post($this->endpoint, [
                    'model' => $this->model,
                    'max_tokens' => 900,
                    'system' => $system,
                    'messages' => $messages,
                ]);
        } catch (ConnectionException $exception) {
            throw new AssistantUnavailable('Connexion impossible au fournisseur d’IA.', 0, $exception);
        }

        if ($response->failed()) {
            throw new AssistantUnavailable("Le fournisseur d'IA a répondu {$response->status()}.");
        }

        $text = collect($response->json('content', []))->where('type', 'text')->pluck('text')->implode("\n");
        if (trim($text) === '') {
            throw new AssistantUnavailable('Réponse vide du fournisseur d’IA.');
        }

        return $text;
    }
}
