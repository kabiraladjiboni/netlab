<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Support\Security\SecurityLog;
use App\Support\Security\Totp;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Espace « Sécurité » : double authentification par application (TOTP).
 *
 * Le secret n'est enregistré qu'après la saisie d'un premier code valide ;
 * il est chiffré en base, et les codes de secours ne sont stockés que sous forme d'empreintes.
 */
class TwoFactorController extends Controller
{
    private const PENDING = 'two_factor.pending';

    public function show(Request $request): Response
    {
        $user = $request->user();
        $pending = $request->session()->get(self::PENDING);

        return Inertia::render('app/security', [
            'enabled' => $user->hasTwoFactor(),
            'confirmedAt' => $user->two_factor_confirmed_at?->toIso8601String(),
            'recoveryRemaining' => count($user->two_factor_recovery_codes ?? []),
            'pending' => $pending ? [
                'secret' => trim(chunk_split($pending, 4, ' ')),
                'uri' => Totp::uri($pending, $user->email, app(\App\Services\Platform\Settings::class)->platformName()),
            ] : null,
            'recoveryCodes' => $request->session()->get('two_factor.codes'),
            'required' => $user->isAdmin() && (bool) config('netlab.security.admin_two_factor'),
            'continueTo' => $user->isAdmin() && $user->hasTwoFactor() ? '/admin' : null,
        ]);
    }

    /** Étape 1 : mot de passe confirmé, un secret provisoire est généré (pas encore actif). */
    public function start(Request $request): RedirectResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        if ($request->user()->hasTwoFactor()) {
            return back();
        }
        $request->session()->put(self::PENDING, Totp::generateSecret());

        return back();
    }

    /** Étape 2 : le premier code prouve que l'application est bien configurée. */
    public function confirm(Request $request): RedirectResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:12']]);
        $secret = $request->session()->get(self::PENDING);
        $user = $request->user();
        if (! $secret) {
            return back()->with('error', 'Recommence l’activation : la configuration a expiré.');
        }

        $step = Totp::verify($secret, $data['code']);
        if ($step === null) {
            SecurityLog::record('2fa.setup_failed', $user, $request, level: 'notice');
            throw ValidationException::withMessages(['code' => 'Code incorrect. Vérifie l’heure de ton téléphone et saisis le code affiché maintenant.']);
        }

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
            'two_factor_last_step' => $step,
        ])->save();
        $codes = $user->regenerateRecoveryCodes();
        $request->session()->forget(self::PENDING);
        SecurityLog::record('2fa.enabled', $user, $request);

        return back()->with('two_factor.codes', $codes)->with('success', 'Double authentification activée. Range tes codes de secours en lieu sûr.');
    }

    public function cancel(Request $request): RedirectResponse
    {
        $request->session()->forget(self::PENDING);

        return back();
    }

    public function recoveryCodes(Request $request): RedirectResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $user = $request->user();
        abort_unless($user->hasTwoFactor(), 404);
        $codes = $user->regenerateRecoveryCodes();
        SecurityLog::record('2fa.recovery_regenerated', $user, $request);

        return back()->with('two_factor.codes', $codes)->with('success', 'Nouveaux codes de secours générés : les anciens ne fonctionnent plus.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'password' => ['required', 'current_password'],
            'code' => ['required', 'string', 'max:20'],
        ]);
        $user = $request->user();
        if (! $user->verifyTwoFactorCode($data['code']) && ! $user->useRecoveryCode($data['code'])) {
            SecurityLog::record('2fa.disable_failed', $user, $request, level: 'warning');
            throw ValidationException::withMessages(['code' => 'Code incorrect.']);
        }
        $user->disableTwoFactor();
        SecurityLog::record('2fa.disabled', $user, $request, level: 'notice');

        return back()->with('success', 'Double authentification désactivée.');
    }
}
