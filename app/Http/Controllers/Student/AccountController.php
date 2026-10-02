<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    public function profile(Request $request): Response
    {
        return Inertia::render('app/profile', [
            'profile' => [
                'name' => $request->user()->name,
                'email' => $request->user()->email,
                'country' => $request->user()->country,
                'verified' => $request->user()->hasVerifiedEmail(),
                'created_at' => $request->user()->created_at?->toIso8601String(),
            ],
            'countries' => \App\Support\Countries::list(),
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'country' => ['nullable', 'string', Rule::in(array_keys(\App\Support\Countries::list()))],
        ]);

        $emailChanged = $data['email'] !== $user->email;
        // Seuls ces trois champs sont modifiables : le rôle ne l'est jamais ici.
        $user->fill(['name' => trim($data['name']), 'email' => $data['email'], 'country' => $data['country'] ?? null]);
        if ($emailChanged) {
            $user->email_verified_at = null;
        }
        $user->save();
        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        return back()->with('success', $emailChanged ? 'Profil mis à jour. Confirme ta nouvelle adresse grâce à l’e-mail envoyé.' : 'Profil mis à jour.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);
        $request->user()->forceFill(['password' => $data['password']])->save();
        \App\Support\Security\SecurityLog::record('password.changed', $request->user(), $request);
        Auth::logoutOtherDevices($data['password']);

        return back()->with('success', 'Mot de passe modifié. Tes autres sessions ont été déconnectées.');
    }

    public function settings(Request $request): Response
    {
        return Inertia::render('app/settings', ['preferences' => $request->user()->preferences ?? (object) []]);
    }

    public function updatePreferences(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate([
            'level' => ['nullable', 'integer', 'in:1,2,3'],
            'theme' => ['nullable', 'in:system,light,dark'],
            'reduce_motion' => ['nullable', 'boolean'],
        ]);
        $request->user()->forceFill(['preferences' => array_filter($data, fn ($value) => $value !== null)])->save();
        if ($request->expectsJson()) {
            return response()->json(['preferences' => $request->user()->preferences]);
        }

        return back()->with('success', 'Préférences enregistrées.');
    }

    /** Droit d'accès : export de toutes les données personnelles du compte. */
    public function export(Request $request): JsonResponse
    {
        $user = $request->user();
        $payload = [
            'exporte_le' => now()->toIso8601String(),
            'compte' => $user->only(['name', 'email', 'country', 'created_at', 'email_verified_at', 'terms_accepted_at', 'last_active_at']),
            'preferences' => $user->preferences,
            'seances_tp' => $user->labSessions()->get()->map->toPublicArray(),
            'quiz' => $user->quizAttempts()->get(['quiz_slug', 'score', 'total', 'duration_seconds', 'created_at']),
            'lecons_consultees' => $user->lessonVisits()->get(['lesson_slug', 'visits', 'first_visited_at', 'last_visited_at']),
            'favoris' => $user->favorites()->get(['subject_type', 'subject_slug', 'created_at']),
            'evaluations' => $user->ratings()->get(['subject_type', 'subject_slug', 'value', 'comment', 'created_at', 'updated_at']),
            'retours' => $user->feedbackReports()->get(['category', 'subject_type', 'subject_slug', 'message', 'status', 'created_at']),
        ];

        return response()->json($payload, 200, [
            'Content-Disposition' => 'attachment; filename="mes-donnees-netlab.json"',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** Suppression définitive du compte et des données personnelles associées. */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
            'confirmation' => ['required', 'in:SUPPRIMER'],
        ], ['confirmation.in' => 'Écris SUPPRIMER en majuscules pour confirmer.']);

        $user = $request->user();
        abort_if($user->isAdmin() && \App\Models\User::where('role', 'admin')->count() <= 1, 422, 'Impossible de supprimer le dernier compte administrateur.');

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        // Les événements analytiques deviennent anonymes (user_id → null) ; les données pédagogiques sont supprimées.
        $user->delete();

        return redirect('/')->with('success', 'Ton compte et tes données ont été supprimés.');
    }
}
