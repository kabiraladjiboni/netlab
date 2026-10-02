<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Publication (brouillon / publié), cours regroupant les leçons (chapitres),
 * et scénarios personnalisés créés depuis l'administration.
 */
return new class extends Migration
{
    private array $publishable = ['lessons', 'protocols', 'technical_terms', 'quizzes', 'diagnostics'];

    public function up(): void
    {
        foreach ($this->publishable as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->string('status_publication', 20)->default('published')->index();
                $table->timestamp('content_updated_at')->nullable();
            });
        }

        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('level', 20)->default('debutant');
            $table->string('status_publication', 20)->default('published')->index();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            $table->text('intro')->nullable();
            $table->json('references')->nullable();
        });

        Schema::create('lesson_protocol', function (Blueprint $table) {
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->foreignId('protocol_id')->constrained()->cascadeOnDelete();
            $table->primary(['lesson_id', 'protocol_id']);
        });

        Schema::create('scenario_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('source', 20)->default('custom'); // builtin | custom
            $table->json('definition')->nullable(); // scénario personnalisé (données validées)
            $table->string('status_publication', 20)->default('draft')->index();
            $table->timestamp('validated_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scenario_definitions');
        Schema::dropIfExists('lesson_protocol');
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropConstrainedForeignId('course_id');
            $table->dropColumn(['intro', 'references']);
        });
        Schema::dropIfExists('courses');
        foreach ($this->publishable as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn(['status_publication', 'content_updated_at']));
        }
    }
};
