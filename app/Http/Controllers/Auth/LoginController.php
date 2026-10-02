<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Analytics\Tracker;
use App\Support\Security\SecurityLog;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function create(Request $request): Response
    {
        Intended::remember($request);

        return Inertia::render('auth/login', [
            'status' => session('status'),
            'email' => session('verified_email'),
            'intended' => Intended::describe($request),
            'canRegister' => app(\App\Services\Platform\Settings::class)->get('accounts.registration_open'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email', 'max:190'],
            'password' => ['required', 'string', 'max:200'],
        ]);
        $remember = $request->boolean('remember');

        $key = Str::transliterate(Str::lower($credentials['email']).'|'.$request->ip());
        if (RateLimiter::tooManyAttempts($key, 5)) {
            event(new Lockout($request));
            $seconds = RateLimiter::availableIn($key);
            throw ValidationException::withMessages([
                'email' => "Trop de tentatives. Réessaie dans {$seconds} secondes.",
            ]);
        }

        // Vérification sans ouvrir de session : la connexion n'est accordée qu'après
        // l'éventuelle double authentification.
        $provider = Auth::getProvider();
        $user = $provider->retrieveByCredentials(['email' => Str::lower($credentials['email'])]);
        if ($user === null) {
            // Même durée de traitement qu'un compte existant : pas d'énumération par le temps de réponse.
            Hash::check($credentials['password'], '$2y$12$jn6aS2KDPpaGickuNY.BVO8EXyWH3VEVMUT3pFXL3CcGyVXzF8582');
        }
        if ($user === null || ! $provider->validateCredentials($user, ['password' => $credentials['password']])) {
            RateLimiter::hit($key, 60);
            event(new Failed('web', $user, ['email' => Str::lower($credentials['email'])]));
            throw ValidationException::withMessages([
                'email' => 'Adresse e-mail ou mot de passe incorrect.',
            ]);
        }
        $provider->rehashPasswordIfRequired($user, ['password' => $credentials['password']]);

        if ($user->isSuspended()) {
            SecurityLog::record('login.suspended', $user, $request, level: 'notice');
            throw ValidationException::withMessages([
                'email' => 'Ce compte est suspendu. Contacte l’équipe de la plateforme si tu penses qu’il s’agit d’une erreur.',
            ]);
        }

        RateLimiter::clear($key);

        if ($user->hasTwoFactor()) {
            $request->session()->put(TwoFactorChallengeController::SESSION, [
                'id' => $user->id,
                'remember' => $remember,
                'expires' => time() + 300,
            ]);

            return redirect()->route('two-factor.challenge');
        }

        Auth::login($user, $remember);
        $request->session()->regenerate();
        app(Tracker::class)->linkSessionToUser($request, $user);

        return redirect()->intended(route($user->isAdmin() ? 'admin.dashboard' : 'student.dashboard', absolute: false))
            ->with('success', 'Bon retour, '.$user->name.' !');
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('success', 'Tu es déconnecté.');
    }
}
