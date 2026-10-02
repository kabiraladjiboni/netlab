<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Analytics\Tracker;
use App\Support\Security\SecurityLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Deuxième étape de connexion : code de l'application ou code de secours. */
class TwoFactorChallengeController extends Controller
{
    public const SESSION = 'login.two_factor';

    private const MAX_ATTEMPTS = 5;

    public function create(Request $request): Response|RedirectResponse
    {
        if ($this->pendingUser($request) === null) {
            return redirect()->route('login')->with('status', 'Ta session de connexion a expiré : reconnecte-toi.');
        }

        return Inertia::render('auth/two-factor-challenge');
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->pendingUser($request);
        if ($user === null) {
            return redirect()->route('login')->with('status', 'Ta session de connexion a expiré : reconnecte-toi.');
        }
        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:12', 'required_without:recovery_code'],
            'recovery_code' => ['nullable', 'string', 'max:20'],
        ]);

        $key = 'two-factor:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            SecurityLog::record('2fa.locked', $user, $request, level: 'warning');
            throw ValidationException::withMessages(['code' => 'Trop d’essais. Réessaie dans '.RateLimiter::availableIn($key).' secondes.']);
        }

        $valid = ! empty($data['recovery_code'])
            ? $user->useRecoveryCode($data['recovery_code'])
            : $user->verifyTwoFactorCode((string) $data['code']);

        if (! $valid) {
            RateLimiter::hit($key, 300);
            SecurityLog::record('2fa.failed', $user, $request, ['recovery' => ! empty($data['recovery_code'])], 'warning');
            throw ValidationException::withMessages([! empty($data['recovery_code']) ? 'recovery_code' : 'code' => 'Code incorrect.']);
        }

        RateLimiter::clear($key);
        $remember = (bool) $request->session()->get(self::SESSION.'.remember', false);
        $request->session()->forget(self::SESSION);
        Auth::login($user, $remember);
        $request->session()->regenerate();
        app(Tracker::class)->linkSessionToUser($request, $user);
        if (! empty($data['recovery_code'])) {
            SecurityLog::record('2fa.recovery_used', $user, $request, ['remaining' => count($user->two_factor_recovery_codes ?? [])], 'notice');
        }

        return redirect()->intended(route($user->isAdmin() ? 'admin.dashboard' : 'student.dashboard', absolute: false))
            ->with('success', 'Bon retour, '.$user->name.' !');
    }

    private function pendingUser(Request $request): ?User
    {
        $pending = $request->session()->get(self::SESSION);
        if (! is_array($pending) || ($pending['expires'] ?? 0) < time()) {
            return null;
        }
        $user = User::find($pending['id'] ?? null);

        return $user !== null && $user->hasTwoFactor() && ! $user->isSuspended() ? $user : null;
    }
}
