<?php

namespace App\Services\Content;

use App\Models\Course;
use App\Models\Diagnostic;
use App\Models\Equipment;
use App\Models\Lesson;
use App\Models\NetworkLayer;
use App\Models\NetworkType;
use App\Models\Protocol;
use App\Models\ProtocolCategory;
use App\Models\ProtocolRelationship;
use App\Models\Quiz;
use App\Models\TechnicalTerm;
use App\Services\Learning\ScenarioCatalog;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Importe le contenu pédagogique depuis database/content/*.json.
 *
 * Les fichiers JSON servent à l'INITIALISATION du contenu : l'import reconstruit
 * entièrement les tables de contenu (opération idempotente). Une fois la
 * plateforme en service, le contenu se gère depuis l'administration ; la
 * commande `netlab:content` refuse alors d'écraser la base sans --force.
 * Les données des étudiants (progression, favoris…) référencent les contenus
 * par leur slug et ne sont jamais supprimées par un import. Chaque élément est
 * validé, ainsi que toutes les références croisées (protocoles liés, termes,
 * couches…). En cas d'erreur, rien n'est écrit.
 */
class ContentImporter
{
    /** @var list<string> */
    private array $errors = [];

    public function __construct(private readonly ContentRepository $files) {}

    /**
     * @return array<string, int> nombre d'éléments importés par type
     *
     * @throws ContentValidationException
     */
    public function import(): array
    {
        $this->errors = [];
        $data = [
            'categories' => $this->files->read('categories.json'),
            'layers' => $this->files->read('layers.json'),
            'terms' => $this->files->read('terms.json'),
            'protocols' => $this->files->readDirectory('protocols'),
            'network_types' => $this->files->read('network-types.json'),
            'equipment' => $this->files->read('equipment.json'),
            'quizzes' => $this->files->read('quizzes.json'),
            'courses' => $this->files->read('courses.json'),
            'lessons' => $this->files->read('lessons.json'),
            'diagnostics' => $this->files->read('diagnostics.json'),
        ];

        $this->validateAll($data);
        if ($this->errors !== []) {
            throw new ContentValidationException($this->errors);
        }

        DB::transaction(function () use ($data) {
            $this->clear();
            $this->importCategories($data['categories']);
            $this->importLayers($data['layers']);
            $this->importTerms($data['terms']);
            $this->importProtocols($data['protocols']);
            $this->importNetworkTypes($data['network_types']);
            $this->importEquipment($data['equipment']);
            $this->importQuizzes($data['quizzes']);
            $this->importCourses($data['courses']);
            $this->importLessons($data['lessons']);
            $this->importDiagnostics($data['diagnostics']);
        });
        app(ScenarioCatalog::class)->syncBuiltins();

        return [
            'catégories' => count($data['categories']),
            'couches' => count($data['layers']),
            'termes' => count($data['terms']),
            'protocoles' => count($data['protocols']),
            'types de réseaux' => count($data['network_types']),
            'équipements' => count($data['equipment']),
            'quiz' => count($data['quizzes']),
            'cours' => count($data['courses']),
            'leçons' => count($data['lessons']),
            'diagnostics' => count($data['diagnostics']),
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Validation                                                           */
    /* ------------------------------------------------------------------ */

    /** @param array<string, list<array<string, mixed>>> $data */
    private function validateAll(array $data): void
    {
        $slug = ['required', 'string', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'];

        $this->validateList('categories.json', $data['categories'], [
            'slug' => $slug, 'name' => 'required|string', 'description' => 'required|string', 'planned' => 'array', 'sort' => 'integer',
        ]);

        $this->validateList('layers.json', $data['layers'], [
            'slug' => $slug, 'model' => 'required|in:osi,tcpip', 'number' => 'required|integer|min:1|max:7',
            'name' => 'required|string', 'english' => 'required|string', 'role' => 'required|string', 'problem' => 'required|string',
            'examples' => 'required|array', 'devices' => 'array', 'pdu' => 'nullable|string', 'neighbors' => 'required|string',
            'note' => 'nullable|string', 'maps_to' => 'array',
        ]);

        $this->validateList('terms.json', $data['terms'], [
            'slug' => $slug, 'term' => 'required|string', 'aliases' => 'array', 'category' => 'nullable|string',
            'simple' => 'required|string', 'technical' => 'required|string', 'example' => 'nullable|string', 'related' => 'array',
        ]);

        $this->validateList('protocols/*.json', $data['protocols'], [
            'slug' => $slug, 'acronym' => 'required|string', 'name' => 'required|string', 'category' => 'required|string',
            'status' => 'required|in:standard,extension,mechanism,tool,proprietary,certification,open-source',
            'completeness' => 'required|in:complete,essential', 'summary' => 'required|string', 'problem' => 'required|string',
            'beginner' => 'required|string', 'analogy' => 'required|string', 'layers' => 'present|array',
            'ports' => 'present|array', 'ports.*.number' => 'required|string', 'ports.*.transport' => 'required|string',
            'references' => 'required|array|min:1', 'references.*.label' => 'required|string', 'references.*.url' => 'nullable|url',
            'related' => 'array', 'related.*.slug' => 'required|string', 'related.*.type' => 'required|in:'.implode(',', array_keys(ProtocolRelationship::TYPES)),
            'terms' => 'array', 'mistakes' => 'array', 'limits' => 'array', 'variants' => 'array',
            'communication' => 'array', 'fields' => 'array', 'packet_example' => 'nullable|array',
        ]);

        // Une fiche « complète » doit réellement contenir toutes les rubriques.
        foreach ($data['protocols'] as $protocol) {
            if (($protocol['completeness'] ?? null) === 'complete') {
                foreach (['communication', 'fields', 'mistakes', 'limits', 'terms'] as $key) {
                    if (empty($protocol[$key])) {
                        $this->errors[] = "Protocole {$protocol['slug']} : fiche complète sans « {$key} ».";
                    }
                }
            }
        }

        $this->validateList('network-types.json', $data['network_types'], [
            'slug' => $slug, 'name' => 'required|string', 'dimension' => 'required|in:geographic,usage,virtual,infrastructure',
            'definition' => 'required|string', 'objective' => 'required|string', 'example' => 'required|string',
            'technologies' => 'array', 'scope' => 'required|string', 'relations' => 'required|string',
        ]);

        $this->validateList('equipment.json', $data['equipment'], [
            'slug' => $slug, 'name' => 'required|string', 'icon' => 'required|string', 'category' => 'required|string',
            'function' => 'required|string', 'problems' => 'required|string', 'examines' => 'required|string',
            'placement' => 'required|string', 'confusions' => 'array', 'layers' => 'array', 'protocols' => 'array',
        ]);

        $this->validateList('quizzes.json', $data['quizzes'], [
            'slug' => $slug, 'title' => 'required|string', 'questions' => 'required|array|min:1',
            'questions.*.type' => 'required|in:single,multiple,order,match', 'questions.*.prompt' => 'required|string',
            'questions.*.explanation' => 'required|string',
        ]);
        foreach ($data['quizzes'] as $quiz) {
            foreach ($quiz['questions'] ?? [] as $index => $question) {
                $this->validateQuestion($quiz['slug'] ?? '?', $index, $question);
            }
        }

        $this->validateList('courses.json', $data['courses'], [
            'slug' => $slug, 'title' => 'required|string', 'level' => 'required|in:'.implode(',', array_keys(Course::LEVELS)), 'description' => 'nullable|string',
        ]);

        $this->validateList('lessons.json', $data['lessons'], [
            'course' => 'required|string',
            'slug' => $slug, 'title' => 'required|string', 'track' => 'required|string', 'objective' => 'required|string',
            'duration' => 'required|integer|min:1', 'kind' => 'required|in:scenario,page', 'href' => 'required|string',
            'scenario_key' => 'nullable|string', 'quiz' => 'nullable|string', 'concepts' => 'array',
        ]);

        $this->validateList('diagnostics.json', $data['diagnostics'], [
            'slug' => $slug, 'title' => 'required|string', 'difficulty' => 'required|in:facile,moyen,difficile',
            'summary' => 'required|string', 'symptoms' => 'required|array|min:1', 'observations' => 'required|array',
            'hints' => 'required|array|min:1', 'choices' => 'required|array|min:2', 'answer' => 'required|integer|min:0',
            'explanation' => 'required|string', 'related' => 'array',
        ]);
        foreach ($data['diagnostics'] as $diagnostic) {
            if (($diagnostic['answer'] ?? 0) >= count($diagnostic['choices'] ?? [])) {
                $this->errors[] = "Diagnostic {$diagnostic['slug']} : la bonne réponse n'existe pas.";
            }
        }

        $this->validateReferences($data);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $rules
     */
    private function validateList(string $file, array $items, array $rules): void
    {
        $seen = [];
        foreach ($items as $index => $item) {
            $label = $item['slug'] ?? "#{$index}";
            $validator = Validator::make($item, $rules);
            foreach ($validator->errors()->all() as $message) {
                $this->errors[] = "{$file} [{$label}] : {$message}";
            }
            if (isset($item['slug'])) {
                if (isset($seen[$item['slug']])) {
                    $this->errors[] = "{$file} : identifiant dupliqué « {$item['slug']} ».";
                }
                $seen[$item['slug']] = true;
            }
        }
    }

    /** @param array<string, mixed> $question */
    private function validateQuestion(string $quiz, int $index, array $question): void
    {
        $where = "Quiz {$quiz}, question ".($index + 1);
        switch ($question['type'] ?? null) {
            case 'single':
                if (count($question['options'] ?? []) < 2 || ! is_int($question['answer'] ?? null) || $question['answer'] >= count($question['options'])) {
                    $this->errors[] = "{$where} : options ou réponse invalides.";
                }
                break;
            case 'multiple':
                $answers = $question['answer'] ?? null;
                if (count($question['options'] ?? []) < 2 || ! is_array($answers) || $answers === [] || max($answers) >= count($question['options'])) {
                    $this->errors[] = "{$where} : options ou réponses invalides.";
                }
                break;
            case 'order':
                if (count($question['items'] ?? []) < 3) {
                    $this->errors[] = "{$where} : au moins 3 éléments à ordonner.";
                }
                break;
            case 'match':
                if (count($question['pairs'] ?? []) < 2) {
                    $this->errors[] = "{$where} : au moins 2 paires.";
                }
                break;
        }
    }

    /** @param array<string, list<array<string, mixed>>> $data */
    private function validateReferences(array $data): void
    {
        $categories = array_column($data['categories'], 'slug');
        $layers = array_map(fn ($layer) => "{$layer['model']}-{$layer['number']}", $data['layers']);
        $terms = array_column($data['terms'], 'slug');
        $protocols = array_column($data['protocols'], 'slug');
        $quizzes = array_column($data['quizzes'], 'slug');

        foreach ($data['terms'] as $term) {
            foreach ($term['related'] ?? [] as $related) {
                if (! in_array($related, $terms, true)) {
                    $this->errors[] = "Terme {$term['slug']} : terme lié inconnu « {$related} ».";
                }
            }
        }

        foreach ($data['protocols'] as $protocol) {
            $slug = $protocol['slug'] ?? '?';
            if (! in_array($protocol['category'] ?? null, $categories, true)) {
                $this->errors[] = "Protocole {$slug} : catégorie inconnue « ".($protocol['category'] ?? '').' ».';
            }
            foreach ($protocol['layers'] ?? [] as $layer) {
                if (! in_array($layer, $layers, true)) {
                    $this->errors[] = "Protocole {$slug} : couche inconnue « {$layer} ».";
                }
            }
            foreach ($protocol['terms'] ?? [] as $term) {
                if (! in_array($term, $terms, true)) {
                    $this->errors[] = "Protocole {$slug} : terme inconnu « {$term} ».";
                }
            }
            foreach ($protocol['related'] ?? [] as $related) {
                if (! in_array($related['slug'] ?? null, $protocols, true)) {
                    $this->errors[] = "Protocole {$slug} : protocole lié inconnu « ".($related['slug'] ?? '').' ».';
                }
                if (($related['slug'] ?? null) === $slug) {
                    $this->errors[] = "Protocole {$slug} : un protocole ne peut pas être lié à lui-même.";
                }
            }
        }

        foreach ($data['equipment'] as $equipment) {
            foreach ($equipment['protocols'] ?? [] as $protocol) {
                if (! in_array($protocol, $protocols, true)) {
                    $this->errors[] = "Équipement {$equipment['slug']} : protocole inconnu « {$protocol} ».";
                }
            }
        }

        $courses = array_column($data['courses'], 'slug');
        foreach ($data['lessons'] as $lesson) {
            if (! in_array($lesson['course'] ?? null, $courses, true)) {
                $this->errors[] = "Leçon {$lesson['slug']} : cours inconnu « ".($lesson['course'] ?? '').' ».';
            }
            if (($lesson['quiz'] ?? null) && ! in_array($lesson['quiz'], $quizzes, true)) {
                $this->errors[] = "Leçon {$lesson['slug']} : quiz inconnu « {$lesson['quiz']} ».";
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Écriture                                                             */
    /* ------------------------------------------------------------------ */

    private function clear(): void
    {
        foreach ([
            'diagnostics', 'lesson_protocol', 'lessons', 'courses', 'quiz_questions', 'quizzes', 'equipment_protocol', 'equipment', 'network_types',
            'protocol_technical_term', 'technical_term_relations', 'protocol_relationships', 'network_layer_protocol',
            'protocols', 'technical_terms', 'network_layers', 'protocol_categories',
        ] as $table) {
            DB::table($table)->delete();
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importCategories(array $items): void
    {
        foreach ($items as $index => $item) {
            ProtocolCategory::create([
                'slug' => $item['slug'], 'name' => $item['name'], 'description' => $item['description'],
                'planned' => $item['planned'] ?? [], 'sort' => $item['sort'] ?? $index,
            ]);
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importLayers(array $items): void
    {
        foreach ($items as $item) {
            NetworkLayer::create([
                ...collect($item)->only(['slug', 'model', 'number', 'name', 'english', 'role', 'problem', 'examples', 'pdu', 'neighbors', 'note'])->all(),
                'devices' => $item['devices'] ?? [],
                'maps_to' => $item['maps_to'] ?? [],
                'search_text' => Text::searchable($item['name'], $item['english'], 'couche '.$item['number'], $item['model'] === 'osi' ? 'osi' : 'tcp/ip tcpip', $item['role']),
            ]);
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importTerms(array $items): void
    {
        $ids = [];
        foreach ($items as $item) {
            $ids[$item['slug']] = TechnicalTerm::create([
                'slug' => $item['slug'], 'term' => $item['term'], 'aliases' => $item['aliases'] ?? [],
                'category' => $item['category'] ?? null, 'simple' => $item['simple'], 'technical' => $item['technical'],
                'example' => $item['example'] ?? null,
                'search_text' => Text::searchable($item['term'], implode(' ', $item['aliases'] ?? []), $item['simple']),
            ])->id;
        }
        foreach ($items as $item) {
            foreach (array_unique($item['related'] ?? []) as $related) {
                DB::table('technical_term_relations')->insertOrIgnore(['technical_term_id' => $ids[$item['slug']], 'related_term_id' => $ids[$related]]);
                DB::table('technical_term_relations')->insertOrIgnore(['technical_term_id' => $ids[$related], 'related_term_id' => $ids[$item['slug']]]);
            }
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importProtocols(array $items): void
    {
        $categories = ProtocolCategory::pluck('id', 'slug');
        $layers = NetworkLayer::all()->keyBy(fn (NetworkLayer $layer) => "{$layer->model}-{$layer->number}");
        $terms = TechnicalTerm::pluck('id', 'slug');
        $ids = [];

        foreach ($items as $index => $item) {
            $protocol = Protocol::create([
                'slug' => $item['slug'],
                'acronym' => $item['acronym'],
                'name' => $item['name'],
                'protocol_category_id' => $categories[$item['category']],
                'status' => $item['status'],
                'completeness' => $item['completeness'],
                'summary' => $item['summary'],
                'problem' => $item['problem'],
                'beginner' => $item['beginner'],
                'analogy' => $item['analogy'],
                'real_example' => $item['real_example'] ?? null,
                'osi_note' => $item['osi_note'] ?? null,
                'tcpip_note' => $item['tcpip_note'] ?? null,
                'ports' => $item['ports'] ?? [],
                'communication' => $item['communication'] ?? [],
                'fields' => $item['fields'] ?? [],
                'packet_example' => $item['packet_example'] ?? null,
                'mistakes' => $item['mistakes'] ?? [],
                'limits' => $item['limits'] ?? [],
                'variants' => $item['variants'] ?? [],
                'references' => $item['references'],
                'scenario_key' => $item['scenario_key'] ?? null,
                'lesson_slug' => $item['lesson_slug'] ?? null,
                'sort' => $item['sort'] ?? $index,
                'search_text' => Text::searchable(
                    $item['acronym'],
                    $item['name'],
                    $item['summary'],
                    implode(' ', array_map(fn ($port) => 'port '.$port['number'], $item['ports'] ?? [])),
                ),
            ]);
            $ids[$item['slug']] = $protocol->id;
            $protocol->layers()->attach(collect($item['layers'] ?? [])->map(fn ($key) => $layers[$key]->id)->all());
            $protocol->terms()->attach(collect($item['terms'] ?? [])->unique()->map(fn ($slug) => $terms[$slug])->all());
        }

        // Relations : la relation réciproque est créée automatiquement si elle n'est pas déclarée.
        foreach ($items as $item) {
            foreach ($item['related'] ?? [] as $related) {
                ProtocolRelationship::updateOrCreate(
                    ['protocol_id' => $ids[$item['slug']], 'related_protocol_id' => $ids[$related['slug']]],
                    ['type' => $related['type'], 'note' => $related['note'] ?? null],
                );
                ProtocolRelationship::firstOrCreate(
                    ['protocol_id' => $ids[$related['slug']], 'related_protocol_id' => $ids[$item['slug']]],
                    ['type' => ProtocolRelationship::INVERSE[$related['type']], 'note' => null],
                );
            }
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importNetworkTypes(array $items): void
    {
        foreach ($items as $index => $item) {
            NetworkType::create([
                ...collect($item)->only(['slug', 'acronym', 'name', 'dimension', 'definition', 'objective', 'example', 'scope', 'relations', 'illustration'])->all(),
                'technologies' => $item['technologies'] ?? [],
                'sort' => $item['sort'] ?? $index,
                'search_text' => Text::searchable($item['acronym'] ?? '', $item['name'], $item['definition']),
            ]);
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importEquipment(array $items): void
    {
        $protocols = Protocol::pluck('id', 'slug');
        foreach ($items as $index => $item) {
            $equipment = Equipment::create([
                ...collect($item)->only(['slug', 'name', 'icon', 'category', 'function', 'problems', 'examines', 'placement'])->all(),
                'confusions' => $item['confusions'] ?? [],
                'layers' => $item['layers'] ?? [],
                'sort' => $item['sort'] ?? $index,
                'search_text' => Text::searchable($item['name'], $item['function']),
            ]);
            $equipment->protocols()->attach(collect($item['protocols'] ?? [])->map(fn ($slug) => $protocols[$slug])->all());
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importQuizzes(array $items): void
    {
        foreach ($items as $item) {
            $quiz = Quiz::create([
                'slug' => $item['slug'], 'title' => $item['title'],
                'description' => $item['description'] ?? null, 'module' => $item['module'] ?? null,
            ]);
            foreach ($item['questions'] as $index => $question) {
                $quiz->questions()->create([
                    'sort' => $index,
                    'type' => $question['type'],
                    'prompt' => $question['prompt'],
                    'context' => $question['context'] ?? null,
                    'explanation' => $question['explanation'],
                    'payload' => collect($question)->only(['options', 'answer', 'items', 'pairs'])->all(),
                ]);
            }
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importCourses(array $items): void
    {
        foreach ($items as $index => $item) {
            Course::create([
                'slug' => $item['slug'], 'title' => $item['title'], 'level' => $item['level'],
                'description' => $item['description'] ?? null, 'sort' => $item['sort'] ?? $index, 'status_publication' => 'published',
            ]);
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importLessons(array $items): void
    {
        $quizzes = Quiz::pluck('id', 'slug');
        $courses = Course::pluck('id', 'slug');
        foreach ($items as $index => $item) {
            $lesson = Lesson::create([
                'course_id' => $courses[$item['course']],
                ...collect($item)->only(['slug', 'title', 'track', 'objective', 'duration', 'kind', 'scenario_key', 'href'])->all(),
                'featured' => $item['featured'] ?? false,
                'concepts' => $item['concepts'] ?? [],
                'quiz_id' => isset($item['quiz']) ? $quizzes[$item['quiz']] : null,
                'sort' => $item['sort'] ?? $index,
                'search_text' => Text::searchable($item['title'], $item['objective'], implode(' ', $item['concepts'] ?? [])),
            ]);
            $lesson->protocols()->attach(Protocol::where('lesson_slug', $item['slug'])->pluck('id')->all());
        }
    }

    /** @param list<array<string, mixed>> $items */
    private function importDiagnostics(array $items): void
    {
        foreach ($items as $index => $item) {
            Diagnostic::create([
                ...collect($item)->only(['slug', 'title', 'difficulty', 'summary', 'symptoms', 'observations', 'hints', 'choices', 'answer', 'explanation'])->all(),
                'related' => $item['related'] ?? [],
                'sort' => $item['sort'] ?? $index,
            ]);
        }
    }
}
