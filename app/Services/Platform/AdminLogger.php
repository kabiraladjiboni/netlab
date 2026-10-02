<?php

namespace App\Services\Platform;

use App\Models\AdminLog;
use App\Models\User;
use Illuminate\Support\Arr;

/**
 * Journal des opérations administratives sensibles.
 * N'y enregistrer que le strict nécessaire : jamais de mot de passe, de jeton
 * ou de clé ; les champs portant ces noms sont retirés par sécurité.
 */
class AdminLogger
{
    private const FORBIDDEN = ['password', 'password_confirmation', 'token', 'remember_token', 'api_key', 'secret'];

    /** @param array<string, mixed> $details */
    public function log(?User $actor, string $action, ?string $subjectType = null, ?string $subjectLabel = null, array $details = []): AdminLog
    {
        $clean = $this->scrub($details);

        return AdminLog::create([
            'user_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_label' => $subjectLabel !== null ? mb_substr($subjectLabel, 0, 250) : null,
            'details' => $clean === [] ? null : $clean,
            'created_at' => now(),
        ]);
    }

    /** @param array<string, mixed> $details */
    private function scrub(array $details): array
    {
        $out = [];
        foreach ($details as $key => $value) {
            if (in_array(strtolower((string) $key), self::FORBIDDEN, true)) {
                continue;
            }
            $out[$key] = is_array($value) ? $this->scrub($value) : (is_string($value) ? mb_substr($value, 0, 300) : $value);
        }

        return Arr::where($out, fn ($value) => $value !== null);
    }
}
