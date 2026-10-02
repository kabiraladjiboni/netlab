<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * Compte utilisateur.
 *
 * Sécurité : `role`, `suspended_at`, `email_verified_at` ne sont PAS assignables
 * en masse. Un utilisateur ne peut donc jamais devenir administrateur en
 * ajoutant un champ à un formulaire ; seuls la commande `netlab:admin` et
 * l'action protégée de l'administration modifient le rôle.
 */
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public const ROLE_STUDENT = 'student';

    public const ROLE_ADMIN = 'admin';

    /** Rôles connus. Un rôle « enseignant » pourra être ajouté ici plus tard. */
    public const ROLES = [self::ROLE_STUDENT => 'Étudiant', self::ROLE_ADMIN => 'Administrateur'];

    protected $fillable = ['name', 'email', 'password', 'country', 'preferences'];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'preferences' => 'array',
            'terms_accepted_at' => 'datetime',
            'last_active_at' => 'datetime',
            'suspended_at' => 'datetime',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /** Double authentification activée (secret confirmé par un premier code). */
    public function hasTwoFactor(): bool
    {
        return $this->two_factor_confirmed_at !== null && $this->two_factor_secret !== null;
    }

    /**
     * Vérifie un code de l'application d'authentification (sans rejeu possible).
     */
    public function verifyTwoFactorCode(string $code): bool
    {
        if (! $this->hasTwoFactor()) {
            return false;
        }
        $step = \App\Support\Security\Totp::verify($this->two_factor_secret, $code, $this->two_factor_last_step);
        if ($step === null) {
            return false;
        }
        $this->forceFill(['two_factor_last_step' => $step])->save();

        return true;
    }

    /** Utilise un code de secours (chaque code ne sert qu'une fois). */
    public function useRecoveryCode(string $code): bool
    {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code) ?? '');
        if ($code === '' || ! $this->hasTwoFactor()) {
            return false;
        }
        $hash = hash('sha256', $code);
        $codes = $this->two_factor_recovery_codes ?? [];
        foreach ($codes as $index => $stored) {
            if (hash_equals($stored, $hash)) {
                unset($codes[$index]);
                $this->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

                return true;
            }
        }

        return false;
    }

    /**
     * Génère 8 nouveaux codes de secours ; seuls leurs empreintes sont conservées.
     *
     * @return array<int, string> codes en clair, à montrer une seule fois
     */
    public function regenerateRecoveryCodes(): array
    {
        $codes = collect(range(1, 8))->map(fn () => strtoupper(bin2hex(random_bytes(3))).'-'.strtoupper(bin2hex(random_bytes(3))))->all();
        $this->forceFill(['two_factor_recovery_codes' => array_map(fn ($c) => hash('sha256', str_replace('-', '', $c)), $codes)])->save();

        return $codes;
    }

    public function disableTwoFactor(): void
    {
        $this->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_step' => null,
        ])->save();
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function labSessions(): HasMany
    {
        return $this->hasMany(LabSession::class);
    }

    public function quizAttempts(): HasMany
    {
        return $this->hasMany(QuizAttempt::class);
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(Favorite::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(ContentRating::class);
    }

    public function lessonVisits(): HasMany
    {
        return $this->hasMany(LessonVisit::class);
    }

    public function feedbackReports(): HasMany
    {
        return $this->hasMany(FeedbackReport::class);
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new \App\Notifications\VerifyEmailFr);
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new \App\Notifications\ResetPasswordFr($token));
    }

    /** Données minimales exposées au frontend. */
    public function toSharedArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'is_admin' => $this->isAdmin(),
            'verified' => $this->hasVerifiedEmail(),
            'country' => $this->country,
            'preferences' => $this->preferences ?: null,
            'two_factor' => $this->hasTwoFactor(),
        ];
    }
}
