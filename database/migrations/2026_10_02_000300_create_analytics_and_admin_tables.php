<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mesure d'audience et administration.
 * Aucune adresse IP n'est stockée : seuls un identifiant de visiteur haché
 * (sel renouvelé chaque jour) et un pays estimé peuvent être conservés.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->id();
            $table->string('type', 40);
            $table->timestamp('occurred_at');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('visitor_hash', 64)->nullable();
            $table->string('session_hash', 64)->nullable();
            $table->string('subject_type', 20)->nullable();
            $table->string('subject_slug')->nullable();
            $table->integer('value')->nullable();
            $table->json('meta')->nullable();
            $table->char('country', 2)->nullable();
            $table->index(['type', 'occurred_at']);
            $table->index(['subject_type', 'subject_slug']);
            $table->index('occurred_at');
        });

        Schema::create('visitor_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_hash', 64)->unique();
            $table->string('visitor_hash', 64)->nullable()->index();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->char('country', 2)->nullable();
            $table->unsignedInteger('signals')->default(1);
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at')->index();
        });

        Schema::create('geo_ip_ranges', function (Blueprint $table) {
            $table->id();
            // Adresses converties en 16 octets (IPv4 mappées) puis en hexadécimal :
            // l'ordre lexicographique correspond à l'ordre numérique.
            $table->char('range_start', 32)->index();
            $table->char('range_end', 32);
            $table->char('country', 2);
        });

        Schema::create('admin_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 60)->index();
            $table->string('subject_type', 40)->nullable();
            $table->string('subject_label')->nullable();
            $table->json('details')->nullable();
            $table->timestamp('created_at')->index();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'admin_logs', 'geo_ip_ranges', 'visitor_sessions', 'analytics_events'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
