<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Auth\Events\Verified;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EmailVerificationController extends Controller
{
    public function notice(Request $request): Response|RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->intended(route('student.dashboard', absolute: false));
        }

        return Inertia::render('auth/verify-email', ['status' => session('status'), 'email' => $request->user()->email]);
    }

    /**
     * Lien reçu par e-mail. Il fonctionne même si la personne l'ouvre dans un
     * autre navigateur ou après expiration de sa session : la signature du lien
     * (route « signed ») et l'empreinte de l'adresse prouvent qu'elle possède
     * la boîte e-mail. Sans session ouverte, on la renvoie vers la connexion
     * avec son adresse déjà saisie (jamais de connexion automatique).
     */
    public function verify(Request $request, string $id, string $hash): RedirectResponse
    {
        $user = User::find($id);
        abort_unless($user !== null && hash_equals(sha1($user->getEmailForVerification()), $hash), 403, 'Ce lien de confirmation n’est pas valide.');

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        $current = $request->user();
        if ($current !== null && $current->is($user)) {
            return redirect()->intended(route('student.dashboard', absolute: false))->with('success', 'Adresse e-mail confirmée. Bonne exploration, Abòrò !');
        }
        if ($current !== null) {
            return redirect()->route('student.dashboard')->with('success', 'L’adresse '.$user->email.' est confirmée.');
        }

        return redirect()->route('login')
            ->with('status', 'Adresse e-mail confirmée ! Saisis ton mot de passe pour accéder à ton espace.')
            ->with('verified_email', $user->email);
    }

    public function resend(Request $request): RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->intended(route('student.dashboard', absolute: false));
        }
        $request->user()->sendEmailVerificationNotification();

        return back()->with('status', 'Un nouveau lien de confirmation vient d’être envoyé.');
    }
}
