<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetController extends Controller
{
    public function request(): Response
    {
        return Inertia::render('auth/forgot-password', ['status' => session('status')]);
    }

    public function email(Request $request): RedirectResponse
    {
        $request->validate(['email' => ['required', 'email', 'max:190']]);
        Password::sendResetLink(['email' => Str::lower($request->string('email'))]);

        // Même message que le compte existe ou non (pas d'énumération des comptes).
        return back()->with('status', 'Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.');
    }

    public function edit(Request $request, string $token): Response
    {
        return Inertia::render('auth/reset-password', ['token' => $token, 'email' => (string) $request->query('email', '')]);
    }

    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::reset(
            ['email' => Str::lower($request->string('email')), 'password' => $request->input('password'), 'password_confirmation' => $request->input('password_confirmation'), 'token' => $request->input('token')],
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'Ce lien de réinitialisation est invalide ou a expiré. Demandes-en un nouveau.']);
        }

        return redirect()->route('login')->with('status', 'Ton mot de passe a été modifié. Tu peux te connecter.');
    }
}
