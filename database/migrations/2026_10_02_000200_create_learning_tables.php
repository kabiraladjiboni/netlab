<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Données pédagogiques personnelles : sessions de TP, quiz, visites, favoris,
 * évaluations et retours. Les contenus sont référencés par leur slug pour que
 * l'historique survive à une réorganisation du catalogue.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('lab_type', 20); // scenario | diagnostic
            $table->string('lab_slug');
            $table->string('variant')->nullable();
            $table->string('status', 20)->default('in_progress'); // in_progress | completed
            $table->unsignedSmallInteger('current_step')->default(0);
            $table->unsignedSmallInteger('total_steps')->default(0);
            $table->json('steps_seen')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('hints_used')->default(0);
            $table->unsignedInteger('active_seconds')->default(0);
            $table->timestamp('started_at');
            $table->timestamp('last_activity_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'lab_type', 'lab_slug']);
            $table->index(['lab_slug', 'status']);
        });

        Schema::create('quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('quiz_slug')->index();
            $table->unsignedSmallInteger('score');
            $table->unsignedSmallInteger('total');
            $table->json('answers')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamp('created_at')->index();
        });

        Schema::create('lesson_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('lesson_slug');
            $table->unsignedInteger('visits')->default(1);
            $table->timestamp('first_visited_at');
            $table->timestamp('last_visited_at')->index();
            $table->unique(['user_id', 'lesson_slug']);
        });

        Schema::create('favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('subject_type', 20); // lesson | protocol | lab
            $table->string('subject_slug');
            $table->timestamp('created_at');
            $table->unique(['user_id', 'subject_type', 'subject_slug']);
            $table->index(['subject_type', 'subject_slug']);
        });

        Schema::create('content_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('subject_type', 20);
            $table->string('subject_slug');
            $table->string('value', 10); // useful | unclear
            $table->text('comment')->nullable();
            $table->string('comment_status', 20)->nullable(); // pending | approved | hidden
            $table->timestamps();
            $table->unique(['user_id', 'subject_type', 'subject_slug']);
            $table->index(['subject_type', 'subject_slug']);
        });

        Schema::create('feedback_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category', 30);
            $table->string('subject_type', 20)->nullable();
            $table->string('subject_slug')->nullable();
            $table->string('page_url', 500)->nullable();
            $table->text('message');
            $table->string('status', 20)->default('new')->index();
            $table->string('priority', 10)->default('normal');
            $table->text('admin_note')->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['feedback_reports', 'content_ratings', 'favorites', 'lesson_visits', 'quiz_attempts', 'lab_sessions'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
