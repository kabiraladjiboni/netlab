<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comptes : rôle (étudiant / administrateur), préférences, suspension.
 * Le rôle n'est jamais assignable en masse (voir App\Models\User).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('student')->index()->after('password');
            $table->char('country', 2)->nullable()->after('role');
            $table->json('preferences')->nullable()->after('country');
            $table->timestamp('terms_accepted_at')->nullable();
            $table->timestamp('last_active_at')->nullable()->index();
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspension_reason', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'country', 'preferences', 'terms_accepted_at', 'last_active_at', 'suspended_at', 'suspension_reason']);
        });
    }
};
