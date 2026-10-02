<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tables du contenu pédagogique. Les colonnes JSON fonctionnent aussi bien
 * avec SQLite (développement) qu'avec MySQL 5.7+ / MariaDB 10.2+.
 * Le contenu est importé depuis database/content/*.json (commande
 * `php artisan netlab:content`), il n'est donc jamais saisi à la main ici.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('protocol_categories', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description');
            $table->json('planned')->nullable();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('network_layers', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('model', 10)->index();
            $table->unsignedTinyInteger('number');
            $table->string('name');
            $table->string('english');
            $table->text('role');
            $table->text('problem');
            $table->json('examples');
            $table->json('devices');
            $table->string('pdu')->nullable();
            $table->text('neighbors');
            $table->text('note')->nullable();
            $table->json('maps_to');
            $table->text('search_text');
            $table->timestamps();
            $table->unique(['model', 'number']);
        });

        Schema::create('protocols', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('acronym');
            $table->string('name');
            $table->foreignId('protocol_category_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20);
            $table->string('completeness', 20)->default('essential');
            $table->text('summary');
            $table->text('problem');
            $table->text('beginner');
            $table->text('analogy');
            $table->text('real_example')->nullable();
            $table->text('osi_note')->nullable();
            $table->text('tcpip_note')->nullable();
            $table->json('ports');
            $table->json('communication');
            $table->json('fields');
            $table->json('packet_example')->nullable();
            $table->json('mistakes');
            $table->json('limits');
            $table->json('variants');
            $table->json('references');
            $table->string('scenario_key')->nullable();
            $table->string('lesson_slug')->nullable();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->text('search_text');
            $table->timestamps();
        });

        Schema::create('network_layer_protocol', function (Blueprint $table) {
            $table->foreignId('network_layer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('protocol_id')->constrained()->cascadeOnDelete();
            $table->primary(['network_layer_id', 'protocol_id']);
        });

        Schema::create('protocol_relationships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('protocol_id')->constrained()->cascadeOnDelete();
            $table->foreignId('related_protocol_id')->constrained('protocols')->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('note')->nullable();
            $table->unique(['protocol_id', 'related_protocol_id']);
        });

        Schema::create('technical_terms', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('term');
            $table->json('aliases');
            $table->string('category')->nullable();
            $table->text('simple');
            $table->text('technical');
            $table->text('example')->nullable();
            $table->text('search_text');
            $table->timestamps();
        });

        Schema::create('technical_term_relations', function (Blueprint $table) {
            $table->foreignId('technical_term_id')->constrained()->cascadeOnDelete();
            $table->foreignId('related_term_id')->constrained('technical_terms')->cascadeOnDelete();
            $table->primary(['technical_term_id', 'related_term_id']);
        });

        Schema::create('protocol_technical_term', function (Blueprint $table) {
            $table->foreignId('protocol_id')->constrained()->cascadeOnDelete();
            $table->foreignId('technical_term_id')->constrained()->cascadeOnDelete();
            $table->primary(['protocol_id', 'technical_term_id']);
        });

        Schema::create('network_types', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('acronym')->nullable();
            $table->string('name');
            $table->string('dimension', 30);
            $table->text('definition');
            $table->text('objective');
            $table->text('example');
            $table->json('technologies');
            $table->string('scope');
            $table->text('relations');
            $table->string('illustration')->nullable();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->text('search_text');
            $table->timestamps();
        });

        Schema::create('equipment', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('icon', 30);
            $table->string('category', 30);
            $table->text('function');
            $table->text('problems');
            $table->text('examines');
            $table->text('placement');
            $table->json('confusions');
            $table->json('layers');
            $table->unsignedSmallInteger('sort')->default(0);
            $table->text('search_text');
            $table->timestamps();
        });

        Schema::create('equipment_protocol', function (Blueprint $table) {
            $table->foreignId('equipment_id')->constrained('equipment')->cascadeOnDelete();
            $table->foreignId('protocol_id')->constrained()->cascadeOnDelete();
            $table->primary(['equipment_id', 'protocol_id']);
        });

        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('module', 40)->nullable()->index();
            $table->timestamps();
        });

        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->string('type', 20);
            $table->text('prompt');
            $table->text('context')->nullable();
            $table->json('payload');
            $table->text('explanation');
            $table->timestamps();
        });

        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('track');
            $table->text('objective');
            $table->unsignedSmallInteger('duration');
            $table->string('kind', 20);
            $table->string('scenario_key')->nullable();
            $table->string('href');
            $table->boolean('featured')->default(false);
            $table->json('concepts');
            $table->foreignId('quiz_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->text('search_text');
            $table->timestamps();
        });

        Schema::create('diagnostics', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('difficulty', 20);
            $table->text('summary');
            $table->json('symptoms');
            $table->json('observations');
            $table->json('hints');
            $table->json('choices');
            $table->unsignedTinyInteger('answer');
            $table->text('explanation');
            $table->json('related');
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach ([
            'diagnostics', 'lessons', 'quiz_questions', 'quizzes', 'equipment_protocol', 'equipment',
            'network_types', 'protocol_technical_term', 'technical_term_relations', 'technical_terms',
            'protocol_relationships', 'network_layer_protocol', 'protocols', 'network_layers', 'protocol_categories',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
