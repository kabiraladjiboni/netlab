<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Analytics\Tracker;
use App\Services\Platform\Settings;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RegisterController extends Controller
{
    public function __construct(private readonly Settings $settings) {}

    public function create(Request $request): Response
    {
        Intended::remember($request);

        return Inertia::render('auth/register', [
            'open' => (bool) $this->settings->get('accounts.registration_open'),
            'intended' => Intended::describe($request),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($this->settings->get('accounts.registration_open'), 403, 'Les inscriptions sont momentanément fermées.');

        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'email' => ['required', 'string', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'terms' => ['accepted'],
        ], [
            'terms.accepted' => 'Tu dois accepter les conditions d’utilisation et la politique de confidentialité.',
            'email.unique' => 'Un compte existe déjà avec cette adresse. Connecte-toi ou réinitialise ton mot de passe.',
        ]);

        // Champs sensibles (rôle, vérification…) volontairement absents : non assignables.
        $user = User::create([
            'name' => trim($data['name']),
            'email' => $data['email'],
            'password' => $data['password'],
        ]);
        $user->forceFill(['terms_accepted_at' => now()])->save();

        event(new Registered($user));
        Auth::login($user);
        $request->session()->regenerate();
        app(Tracker::class)->linkSessionToUser($request, $user);
        app(Tracker::class)->record($request, 'signup');

        return redirect()->intended(route('student.dashboard', absolute: false))
            ->with('success', 'Compte créé ! Un e-mail de confirmation t’a été envoyé.');
    }
}
