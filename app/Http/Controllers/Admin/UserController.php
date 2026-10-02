<?php

namespace App\Http\Controllers\Admin;

use App\Support\Security\Csv;
use App\Models\LabSession;
use App\Models\User;
use App\Support\Countries;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Gestion des comptes. Seules les données nécessaires à l'administration sont
 * affichées ; mots de passe et jetons ne sortent jamais de la base.
 */
class UserController extends AdminController
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(array_keys(User::ROLES))],
            'statut' => ['nullable', Rule::in(['actif', 'suspendu', 'non-verifie'])],
            'du' => ['nullable', 'date'],
            'au' => ['nullable', 'date'],
        ]);

        $users = User::query()
            ->when($filters['q'] ?? null, fn ($query, $q) => $query->where(fn ($w) => $w->where('name', 'like', '%'.addcslashes($q, '%_\\').'%')->orWhere('email', 'like', '%'.addcslashes($q, '%_\\').'%')))
            ->when($filters['role'] ?? null, fn ($query, $role) => $query->where('role', $role))
            ->when(($filters['statut'] ?? null) === 'suspendu', fn ($query) => $query->whereNotNull('suspended_at'))
            ->when(($filters['statut'] ?? null) === 'actif', fn ($query) => $query->whereNull('suspended_at'))
            ->when(($filters['statut'] ?? null) === 'non-verifie', fn ($query) => $query->whereNull('email_verified_at'))
            ->when($filters['du'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['au'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->withCount(['labSessions as labs_completed' => fn ($q) => $q->where('lab_type', 'scenario')->where('status', 'completed'), 'quizAttempts'])
            ->latest()
            ->paginate(25)->withQueryString()
            ->through(fn (User $user) => $this->row($user));

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => $filters,
            'counts' => [
                'total' => User::count(),
                'students' => User::where('role', User::ROLE_STUDENT)->count(),
                'admins' => User::where('role', User::ROLE_ADMIN)->count(),
                'suspended' => User::whereNotNull('suspended_at')->count(),
                'unverified' => User::whereNull('email_verified_at')->count(),
            ],
        ]);
    }

    public function show(User $user): Response
    {
        $sessions = $user->labSessions()->latest('last_activity_at')->limit(20)->get();

        return Inertia::render('admin/users/show', [
            'account' => [
                ...$this->row($user),
                'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                'suspension_reason' => $user->suspension_reason,
            ],
            'learning' => [
                'labs_started' => $user->labSessions()->where('lab_type', 'scenario')->count(),
                'labs_completed' => $user->labSessions()->where('lab_type', 'scenario')->where('status', 'completed')->count(),
                'diagnostics_solved' => $user->labSessions()->where('lab_type', 'diagnostic')->where('status', 'completed')->count(),
                'quiz_attempts' => $user->quizAttempts()->count(),
                'quiz_average' => ($avg = $user->quizAttempts()->get()->avg(fn ($a) => $a->percent())) !== null ? (int) round($avg) : null,
                'lessons_visited' => $user->lessonVisits()->count(),
                'favorites' => $user->favorites()->count(),
                'feedback' => $user->feedbackReports()->count(),
                'sessions' => $sessions->map(fn (LabSession $s) => ['id' => $s->id, 'type' => $s->lab_type, 'slug' => $s->lab_slug, 'status' => $s->status, 'progress' => $s->progressPercent(), 'date' => $s->last_activity_at->toIso8601String()]),
            ],
            'isSelf' => request()->user()->is($user),
        ]);
    }

    public function suspend(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        abort_if($request->user()->is($user), 422, 'Tu ne peux pas suspendre ton propre compte.');
        abort_if($user->isAdmin(), 422, 'Retire d’abord le rôle administrateur.');

        $user->forceFill(['suspended_at' => now(), 'suspension_reason' => $data['reason']])->save();
        $this->log($request, 'user.suspended', 'user', $user->email, ['reason' => $data['reason']]);

        return back()->with('success', 'Compte suspendu. L’utilisateur est déconnecté à sa prochaine requête.');
    }

    public function reactivate(Request $request, User $user): RedirectResponse
    {
        $user->forceFill(['suspended_at' => null, 'suspension_reason' => null])->save();
        $this->log($request, 'user.reactivated', 'user', $user->email);

        return back()->with('success', 'Compte réactivé.');
    }

    /** Changement de rôle : action protégée (administrateur + mot de passe de l'administrateur). */
    public function role(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(array_keys(User::ROLES))],
            'password' => ['required', 'current_password'],
        ]);
        abort_if($request->user()->is($user), 422, 'Tu ne peux pas modifier ton propre rôle.');
        if ($data['role'] !== User::ROLE_ADMIN && $user->isAdmin() && User::where('role', User::ROLE_ADMIN)->count() <= 1) {
            abort(422, 'Impossible de retirer le dernier administrateur.');
        }
        if ($data['role'] === User::ROLE_ADMIN && ! $user->hasVerifiedEmail()) {
            return back()->with('error', 'L’adresse e-mail doit être vérifiée avant de donner le rôle administrateur.');
        }

        $user->forceFill(['role' => $data['role']])->save();
        $this->log($request, 'user.role_changed', 'user', $user->email, ['role' => $data['role']]);

        return back()->with('success', 'Rôle mis à jour : '.User::ROLES[$data['role']].'.');
    }

    public function resendVerification(Request $request, User $user): RedirectResponse
    {
        if ($user->hasVerifiedEmail()) {
            return back()->with('error', 'Cette adresse est déjà vérifiée.');
        }
        $user->sendEmailVerificationNotification();
        $this->log($request, 'user.verification_resent', 'user', $user->email);

        return back()->with('success', 'E-mail de vérification renvoyé.');
    }

    /** Traitement d'une demande de suppression : suppression définitive après confirmation. */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $request->validate(['confirmation' => ['required', Rule::in([$user->email])]], ['confirmation.in' => 'Recopie exactement l’adresse e-mail du compte pour confirmer.']);
        abort_if($request->user()->is($user), 422, 'Supprime ton propre compte depuis ton espace personnel.');
        abort_if($user->isAdmin(), 422, 'Retire d’abord le rôle administrateur.');

        $email = $user->email;
        $user->delete();
        $this->log($request, 'user.deleted', 'user', $email);

        return redirect()->route('admin.users.index')->with('success', 'Compte et données personnelles supprimés.');
    }

    /** Export CSV limité aux champs nécessaires (pas de mot de passe, pas d'adresse IP). */
    public function export(Request $request): StreamedResponse
    {
        $this->log($request, 'export.users', 'report', 'utilisateurs');

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            Csv::put($out, ['id', 'nom', 'email', 'role', 'email_verifie', 'pays_declare', 'inscription', 'derniere_activite', 'suspendu']);
            User::query()->orderBy('id')->chunk(500, function ($users) use ($out) {
                foreach ($users as $user) {
                    Csv::put($out, [
                        $user->id, $user->name, $user->email, $user->role, $user->hasVerifiedEmail() ? 'oui' : 'non', $user->country,
                        $user->created_at?->format('Y-m-d'), $user->last_active_at?->format('Y-m-d H:i'), $user->isSuspended() ? 'oui' : 'non',
                    ]);
                }
            });
            fclose($out);
        }, 'aboro-labs-utilisateurs-'.now()->format('Ymd').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function row(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'verified' => $user->hasVerifiedEmail(),
            'suspended' => $user->isSuspended(),
            'country' => $user->country,
            'country_name' => Countries::name($user->country),
            'created_at' => $user->created_at?->toIso8601String(),
            'last_active_at' => $user->last_active_at?->toIso8601String(),
            'labs_completed' => $user->labs_completed ?? null,
            'quiz_attempts' => $user->quiz_attempts_count ?? null,
        ];
    }
}
