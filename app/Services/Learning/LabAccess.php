<?php

namespace App\Services\Learning;

use App\Models\User;
use App\Services\Platform\Settings;

/** Même règle que le middleware « lab », utilisable dans les contrôleurs. */
class LabAccess
{
    public function __construct(private readonly Settings $settings) {}

    /** @return 'allowed'|'guest'|'unverified' */
    public function status(?User $user): string
    {
        if ($user === null) {
            return 'guest';
        }
        if ($this->settings->get('accounts.require_verification') && ! $user->hasVerifiedEmail() && ! $user->isAdmin()) {
            return 'unverified';
        }

        return 'allowed';
    }

    public function allows(?User $user): bool
    {
        return $this->status($user) === 'allowed';
    }
}
