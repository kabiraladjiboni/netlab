<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ProvidesEngagement;
use App\Models\Course;
use App\Models\Diagnostic;
use App\Models\Equipment;
use App\Models\Lesson;
use App\Models\NetworkLayer;
use App\Models\NetworkType;
use App\Models\Protocol;
use App\Models\ProtocolCategory;
use App\Models\Quiz;
use App\Models\TechnicalTerm;
use App\Services\Analytics\Tracker;
use App\Services\Learning\LabAccess;
use App\Services\Platform\Settings;
use App\Support\Presenters\ContentPresenter;
use App\Support\Seo\Seo;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    use ProvidesEngagement;

    public function home(Seo $seo): Response
    {
        $protocols = Protocol::published()->count();
        $seo->title($seo->brand().' — Apprendre les réseaux informatiques en animations', true)
            ->description("Comprends comment fonctionne Internet : DNS, TCP, TLS, NAT, VLAN… Animations pas à pas, {$protocols} fiches protocoles, TP virtuels et quiz gratuits, en français.");

        return Inertia::render('home', [
            'featured' => Lesson::published()->where('featured', true)->orderBy('sort')->get()->map->toSummary(),
            'stats' => [
                'protocols' => Protocol::published()->count(),
                'complete' => Protocol::published()->where('completeness', 'complete')->count(),
                'terms' => TechnicalTerm::published()->count(),
                'lessons' => Lesson::published()->count(),
                'labs' => Lesson::published()->where('kind', 'scenario')->count(),
                'quizzes' => Quiz::published()->count(),
                'diagnostics' => Diagnostic::published()->count(),
            ],
            'categories' => ProtocolCategory::withCount(['protocols' => fn ($query) => $query->published()])->orderBy('sort')->get(['id', 'slug', 'name', 'description'])
                ->map(fn (ProtocolCategory $category) => [
                    'slug' => $category->slug, 'name' => $category->name, 'description' => $category->description, 'count' => $category->protocols_count,
                ]),
        ]);
    }

    public function learn(Request $request, Seo $seo): Response
    {
        $courses = Course::published()->with(['lessons' => fn ($query) => $query->published()->with('quiz')])->orderBy('sort')->get();
        $seo->title('Cours de réseaux informatiques gratuits')
            ->description('Des parcours progressifs pour apprendre les réseaux : les bases d’Internet, l’adressage, le transport, la sécurité. Chaque leçon s’appuie sur une animation et un quiz.')
            ->breadcrumbs([['Cours', '/apprendre']])
            ->schema([
                '@type' => 'ItemList',
                'name' => 'Cours de réseaux informatiques',
                'itemListElement' => $courses->values()->map(fn (Course $course, int $i) => [
                    '@type' => 'ListItem', 'position' => $i + 1, 'url' => $seo->url('/cours/'.$course->slug), 'name' => $course->title,
                ])->all(),
            ]);
        $sessions = $request->user()?->labSessions()->where('lab_type', 'scenario')->get()->groupBy('lab_slug') ?? collect();
        $visits = $request->user()?->lessonVisits()->pluck('lesson_slug')->flip() ?? collect();
        $status = function (Lesson $lesson) use ($sessions, $visits) {
            $items = $sessions->get($lesson->slug);
            if ($items) {
                return ['completed' => $items->contains('status', 'completed'), 'progress' => (int) $items->max(fn ($s) => $s->progressPercent())];
            }

            return $visits->has($lesson->slug) ? ['completed' => false, 'progress' => 0, 'visited' => true] : null;
        };

        return Inertia::render('learn', [
            'courses' => $courses->map(fn (Course $course) => [
                'slug' => $course->slug,
                'title' => $course->title,
                'description' => $course->description,
                'level' => $course->level,
                'lessons' => $course->lessons->map(fn (Lesson $lesson) => [...$lesson->toSummary(), 'quiz' => $lesson->quiz?->slug, 'status' => $status($lesson)])->values(),
            ])->filter(fn ($course) => $course['lessons']->isNotEmpty())->values(),
        ]);
    }

    public function course(Request $request, string $slug, Seo $seo): Response
    {
        $course = Course::with(['lessons' => fn ($query) => $query->published()->with('quiz')])->where('slug', $slug)->firstOrFail();
        $this->ensureVisible($request->user(), $course->status_publication === 'published');
        $this->describeCourse($seo, $course);
        $sessions = $request->user()?->labSessions()->where('lab_type', 'scenario')->get()->groupBy('lab_slug') ?? collect();

        return Inertia::render('courses/show', [
            'course' => [
                'slug' => $course->slug, 'title' => $course->title, 'description' => $course->description, 'level' => $course->level,
                'lessons' => $course->lessons->map(function (Lesson $lesson) use ($sessions) {
                    $items = $sessions->get($lesson->slug);

                    return [
                        ...$lesson->toSummary(),
                        'concepts' => $lesson->concepts,
                        'status' => $items ? ['completed' => $items->contains('status', 'completed'), 'progress' => $items->max(fn ($s) => $s->progressPercent())] : null,
                    ];
                })->values(),
            ],
        ]);
    }

    public function privacy(Settings $settings, Seo $seo): Response
    {
        $seo->title('Politique de confidentialité')
            ->description('Quelles données '.$seo->brand().' collecte, pourquoi, combien de temps elles sont conservées et comment exercer tes droits.')
            ->breadcrumbs([['Confidentialité', '/confidentialite']]);

        return Inertia::render('legal/privacy', [
            'retentionDays' => (int) $settings->get('analytics.retention_days'),
            'presenceWindow' => (int) $settings->get('analytics.presence_window'),
            'contact' => $settings->get('platform.contact_email'),
        ]);
    }

    public function story(Settings $settings, Seo $seo): Response
    {
        $seo->title('Notre histoire : pourquoi « Abòrò » ?')
            ->description('Abòrò évoque l’amitié, la convivialité et le plaisir d’apprendre ensemble. Découvre la mission, la vision et la promesse de '.$seo->brand().'.')
            ->type('website')
            ->breadcrumbs([['Notre histoire', '/notre-histoire']])
            ->schema(['@type' => 'AboutPage', 'name' => 'Notre histoire', 'url' => $seo->url('/notre-histoire'), 'about' => ['@id' => $seo->baseUrl().'/#organisation']]);

        return Inertia::render('story', [
            'story' => $settings->get('brand.story'),
            'aboroMeaning' => $settings->get('brand.aboro_meaning'),
            'stats' => [
                'labs' => Lesson::published()->where('kind', 'scenario')->count(),
                'protocols' => Protocol::published()->count(),
                'diagnostics' => Diagnostic::published()->count(),
            ],
        ]);
    }

    public function terms(Settings $settings, Seo $seo): Response
    {
        $seo->title('Conditions d’utilisation')
            ->description('Les règles d’utilisation de '.$seo->brand().' : compte gratuit, contenus pédagogiques, comportement attendu et limites du service.')
            ->breadcrumbs([['Conditions d’utilisation', '/conditions']]);

        return Inertia::render('legal/terms', ['contact' => $settings->get('platform.contact_email')]);
    }

    public function osi(Request $request, Seo $seo): Response
    {
        $seo->title('Modèle OSI : les 7 couches expliquées simplement')
            ->description('Les 7 couches du modèle OSI, de la couche physique à l’application : rôle de chaque couche, protocoles associés, encapsulation animée et quiz.')
            ->canonical('/modeles/osi')
            ->breadcrumbs([['Modèles', '/modeles/osi'], ['Modèle OSI', '/modeles/osi']])
            ->schema($this->learningResource($seo, 'Le modèle OSI', 'Les 7 couches du modèle OSI et l’encapsulation des données.', '/modeles/osi', ['Modèle OSI', 'Encapsulation']));

        return Inertia::render('models/osi', [
            'layers' => NetworkLayer::where('model', 'osi')->orderBy('number')->get()->map(fn ($layer) => ContentPresenter::layer($layer)),
            'tcpip' => NetworkLayer::where('model', 'tcpip')->orderBy('number')->get()->map(fn ($layer) => ContentPresenter::layer($layer)),
            'quiz' => Quiz::where('slug', 'quiz-osi')->first()?->toPayload(),
            'initialLayer' => $this->layerParam($request, 7),
        ]);
    }

    public function tcpip(Request $request, Seo $seo): Response
    {
        $seo->title('Modèle TCP/IP : les 4 couches d’Internet')
            ->description('Le modèle TCP/IP utilisé par Internet : ses 4 couches, leurs protocoles (IP, TCP, UDP, HTTP…) et la comparaison avec le modèle OSI.')
            ->canonical('/modeles/tcp-ip')
            ->breadcrumbs([['Modèles', '/modeles/osi'], ['Modèle TCP/IP', '/modeles/tcp-ip']])
            ->schema($this->learningResource($seo, 'Le modèle TCP/IP', 'Les 4 couches du modèle TCP/IP comparées au modèle OSI.', '/modeles/tcp-ip', ['Modèle TCP/IP', 'Modèle OSI']));

        return Inertia::render('models/tcp-ip', [
            'layers' => NetworkLayer::where('model', 'tcpip')->orderBy('number')->get()->map(fn ($layer) => ContentPresenter::layer($layer)),
            'osi' => NetworkLayer::where('model', 'osi')->orderBy('number')->get()->map(fn ($layer) => ContentPresenter::layer($layer)),
            'quiz' => Quiz::where('slug', 'quiz-tcpip')->first()?->toPayload(),
            'initialLayer' => $this->layerParam($request, 4),
        ]);
    }

    public function networks(Request $request, Seo $seo): Response
    {
        $seo->title('Types de réseaux : LAN, WAN, MAN, VPN…')
            ->description('Les grands types de réseaux informatiques expliqués avec des schémas : LAN, WLAN, MAN, WAN, VPN, réseaux d’accès, de transport et de cœur.')
            ->canonical('/reseaux')
            ->breadcrumbs([['Types de réseaux', '/reseaux']])
            ->schema($this->learningResource($seo, 'Les types de réseaux', 'LAN, WAN, VPN et autres types de réseaux.', '/reseaux', ['LAN', 'WAN', 'VPN']));

        return Inertia::render('networks', [
            'types' => NetworkType::orderBy('sort')->get()->map(fn ($type) => ContentPresenter::networkType($type)),
            'quiz' => Quiz::where('slug', 'quiz-reseaux')->first()?->toPayload(),
            'initialType' => $request->string('type')->limit(60)->toString() ?: null,
        ]);
    }

    public function equipment(Request $request, Seo $seo): Response
    {
        $seo->title('Équipements réseau : routeur, switch, box, point d’accès…')
            ->description('À quoi sert chaque équipement réseau ? Routeur, commutateur, box, point d’accès Wi-Fi, pare-feu, serveur : rôle, couche OSI et place dans une architecture.')
            ->canonical('/equipements')
            ->breadcrumbs([['Types de réseaux', '/reseaux'], ['Équipements', '/equipements']])
            ->schema($this->learningResource($seo, 'Les équipements réseau', 'Rôle des équipements réseau et leur place dans une architecture.', '/equipements', ['Routeur', 'Commutateur']));

        return Inertia::render('equipment', [
            'equipment' => Equipment::orderBy('sort')->get()->map(fn ($item) => ContentPresenter::equipment($item)),
            'quiz' => Quiz::where('slug', 'quiz-equipements')->first()?->toPayload(),
            'initialEquipment' => $request->string('equipement')->limit(60)->toString() ?: null,
        ]);
    }

    public function segmentation(Seo $seo): Response
    {
        $seo->title('VLAN, sous-réseaux et segmentation réseau')
            ->description('Pourquoi et comment découper un réseau : VLAN 802.1Q, sous-réseaux et masques, VPN et tunnels. Explications, schémas et quiz.')
            ->breadcrumbs([['Types de réseaux', '/reseaux'], ['Segmentation', '/segmentation']])
            ->schema($this->learningResource($seo, 'Segmentation réseau', 'VLAN, sous-réseaux et tunnels.', '/segmentation', ['VLAN', 'Sous-réseau']));

        return Inertia::render('segmentation', [
            'protocols' => Protocol::whereIn('slug', ['vlan-8021q', 'vxlan', 'mpls', 'ipsec', 'wireguard', 'stp-rstp'])->get()
                ->map(fn ($protocol) => ContentPresenter::protocolSummary($protocol)),
            'types' => NetworkType::whereIn('slug', ['lan', 'wan', 'vpn', 'reseau-acces', 'reseau-transport', 'reseau-coeur'])->orderBy('sort')->get()
                ->map(fn ($type) => ContentPresenter::networkType($type)),
            'quiz' => Quiz::where('slug', 'quiz-vlan')->first()?->toPayload(),
        ]);
    }

    public function wireshark(Seo $seo): Response
    {
        $seo->title('Apprendre à lire une capture Wireshark')
            ->description('Comprendre une capture Wireshark pas à pas : colonnes, détail des en-têtes, filtres d’affichage, et ce qu’on peut (ou pas) voir d’un échange chiffré.')
            ->breadcrumbs([['Wireshark', '/wireshark']])
            ->schema($this->learningResource($seo, 'Lire une capture Wireshark', 'Analyse de paquets avec Wireshark.', '/wireshark', ['Wireshark', 'Analyse de paquets']));

        return Inertia::render('wireshark', [
            'quiz' => Quiz::where('slug', 'quiz-wireshark')->first()?->toPayload(),
        ]);
    }

    public function diagnostics(Seo $seo): Response
    {
        $seo->title('Exercices de diagnostic réseau')
            ->description('Des pannes réseau réalistes à résoudre : observe les symptômes, demande des indices, trouve la cause. Exercices gratuits pour s’entraîner au dépannage.')
            ->breadcrumbs([['Diagnostic', '/diagnostic']]);

        return Inertia::render('diagnostics/index', [
            'diagnostics' => Diagnostic::published()->orderBy('sort')->get(['slug', 'title', 'difficulty', 'summary']),
        ]);
    }

    public function diagnostic(Request $request, string $slug, LabAccess $access, Tracker $tracker): Response
    {
        $user = $request->user();
        $diagnostic = Diagnostic::where('slug', $slug)->firstOrFail();
        $this->ensureVisible($user, $diagnostic->isPublished());
        $seo = app(Seo::class);
        $seo->title('Diagnostic : '.$diagnostic->title)
            ->description($diagnostic->summary)
            ->breadcrumbs([['Diagnostic', '/diagnostic'], [$diagnostic->title, '/diagnostic/'.$diagnostic->slug]])
            ->modified($diagnostic->updated_at)
            ->schema([...$this->learningResource($seo, $diagnostic->title, (string) $diagnostic->summary, '/diagnostic/'.$diagnostic->slug, ['Dépannage réseau']), 'learningResourceType' => 'Exercice de diagnostic']);
        if (! $diagnostic->isPublished()) {
            $seo->noindex();
        }
        $all = Diagnostic::published()->orderBy('sort')->pluck('slug')->values();
        $index = $all->search($slug);
        $status = $access->status($user);
        $tracker->recordOnce($request, 'diagnostic_view', 'diagnostic', $slug);

        $session = $user?->labSessions()->where('lab_type', 'diagnostic')->where('lab_slug', $slug)->latest('last_activity_at')->first();
        $reveal = $session !== null && ($session->isCompleted() || $session->attempts >= 2);

        // La bonne réponse et l'explication ne sont jamais envoyées avant d'avoir été méritées :
        // la correction passe par l'API (LearningApiController::diagnosticAnswer).
        return Inertia::render('diagnostics/show', [
            'diagnostic' => [
                ...$diagnostic->only(['slug', 'title', 'difficulty', 'summary', 'symptoms']),
                'observations' => $status === 'allowed' ? $diagnostic->observations : array_slice($diagnostic->observations, 0, 1),
                'observations_total' => count($diagnostic->observations),
                'hints_total' => count($diagnostic->hints),
                'choices' => $status === 'allowed' ? $diagnostic->choices : [],
            ],
            'access' => $status,
            'state' => $session ? [
                'status' => $session->status,
                'attempts' => $session->attempts,
                'hints' => array_slice($diagnostic->hints, 0, $session->hints_used),
                'answer' => $reveal ? $diagnostic->answer : null,
                'explanation' => $reveal ? $diagnostic->explanation : null,
                'related' => $reveal ? $diagnostic->related : [],
            ] : null,
            'next' => $index !== false ? ($all[$index + 1] ?? null) : null,
            'previous' => $index !== false && $index > 0 ? $all[$index - 1] : null,
        ]);
    }

    public function quizzes(Seo $seo): Response
    {
        $seo->title('Quiz de réseaux informatiques')
            ->description('Teste tes connaissances en réseaux : DNS, TCP/IP, modèle OSI, VLAN, Wireshark… Des quiz corrigés et expliqués, gratuits.')
            ->breadcrumbs([['Quiz', '/quiz']]);

        return Inertia::render('quiz/index', [
            'quizzes' => Quiz::published()->withCount('questions')->orderBy('module')->orderBy('id')->get()->map(fn (Quiz $quiz) => [
                'slug' => $quiz->slug, 'title' => $quiz->title, 'module' => $quiz->module, 'count' => $quiz->questions_count,
            ]),
        ]);
    }

    public function quiz(Request $request, string $slug): Response
    {
        $quiz = Quiz::where('slug', $slug)->firstOrFail();
        $this->ensureVisible($request->user(), $quiz->isPublished());
        $seo = app(Seo::class);
        $seo->title($quiz->title)
            ->description($quiz->description ?: 'Quiz corrigé et expliqué pour vérifier ce que tu as compris.')
            ->breadcrumbs([['Quiz', '/quiz'], [$quiz->title, '/quiz/'.$quiz->slug]])
            ->schema(['@type' => 'Quiz', 'name' => $quiz->title, 'url' => $seo->url('/quiz/'.$quiz->slug), 'inLanguage' => 'fr', 'isAccessibleForFree' => true, 'educationalUse' => 'Évaluation formative', 'provider' => ['@id' => $seo->baseUrl().'/#organisation']]);
        if (! $quiz->isPublished()) {
            $seo->noindex();
        }
        $best = $request->user()?->quizAttempts()->where('quiz_slug', $slug)->get()->max(fn ($attempt) => $attempt->percent());

        return Inertia::render('quiz/show', [
            'quiz' => $quiz->toPayload(),
            'lesson' => Lesson::published()->where('quiz_id', $quiz->id)->first()?->toSummary(),
            'best' => $best,
        ]);
    }

    public function glossary(Seo $seo, ?string $slug = null): Response
    {
        $selected = $slug ? TechnicalTerm::published()->where('slug', $slug)->firstOrFail() : null;
        $setId = $seo->baseUrl().'/dictionnaire#termes';
        if ($selected) {
            $seo->title($selected->term.' : définition simple et exemple')
                ->description($selected->term.' : '.$selected->simple)
                ->canonical('/dictionnaire/'.$selected->slug)
                ->modified($selected->updated_at)
                ->breadcrumbs([['Dictionnaire', '/dictionnaire'], [$selected->term, '/dictionnaire/'.$selected->slug]])
                ->schema([
                    '@type' => 'DefinedTerm',
                    'name' => $selected->term,
                    ...($selected->aliases ? ['alternateName' => array_values((array) $selected->aliases)] : []),
                    'description' => Seo::clean((string) $selected->simple),
                    'url' => $seo->url('/dictionnaire/'.$selected->slug),
                    'inDefinedTermSet' => ['@id' => $setId],
                ]);
        } else {
            $count = TechnicalTerm::published()->count();
            $seo->title("Dictionnaire des réseaux informatiques : {$count} termes expliqués")
                ->description("{$count} termes de réseaux informatiques expliqués simplement, avec une définition technique et un exemple : adresse IP, DNS, MAC, NAT, port, routage…")
                ->canonical('/dictionnaire')
                ->breadcrumbs([['Dictionnaire', '/dictionnaire']])
                ->schema(['@type' => 'DefinedTermSet', '@id' => $setId, 'name' => 'Dictionnaire des réseaux informatiques', 'inLanguage' => 'fr', 'url' => $seo->url('/dictionnaire')]);
        }

        return Inertia::render('glossary', [
            'terms' => TechnicalTerm::published()->orderBy('term')->get(['slug', 'term', 'aliases', 'category', 'simple']),
            'selected' => $selected?->toDetail(),
        ]);
    }

    /**
     * @param  array<int, string>  $teaches
     * @return array<string, mixed>
     */
    private function learningResource(Seo $seo, string $name, string $description, string $path, array $teaches): array
    {
        return [
            '@type' => 'LearningResource',
            'name' => $name,
            'description' => $description,
            'url' => $seo->url($path),
            'inLanguage' => 'fr',
            'isAccessibleForFree' => true,
            'learningResourceType' => 'Explication interactive',
            'teaches' => $teaches,
            'provider' => ['@id' => $seo->baseUrl().'/#organisation'],
        ];
    }

    private function describeCourse(Seo $seo, Course $course): void
    {
        $minutes = (int) $course->lessons->sum('duration');
        $levels = ['debutant' => 'Débutant', 'intermediaire' => 'Intermédiaire', 'avance' => 'Avancé'];
        $seo->title($course->title.' — cours de réseaux gratuit')
            ->description($course->description)
            ->modified($course->updated_at)
            ->breadcrumbs([['Cours', '/apprendre'], [$course->title, '/cours/'.$course->slug]])
            ->schema(array_filter([
                '@type' => 'Course',
                'name' => $course->title,
                'description' => Seo::clean((string) $course->description),
                'url' => $seo->url('/cours/'.$course->slug),
                'inLanguage' => 'fr',
                'isAccessibleForFree' => true,
                'educationalLevel' => $levels[$course->level] ?? null,
                'provider' => ['@id' => $seo->baseUrl().'/#organisation'],
                'offers' => ['@type' => 'Offer', 'category' => 'Free', 'price' => 0, 'priceCurrency' => 'XOF'],
                'hasCourseInstance' => array_filter(['@type' => 'CourseInstance', 'courseMode' => 'Online', 'courseWorkload' => Seo::duration($minutes)]),
                'hasPart' => $course->lessons->map(fn (Lesson $lesson) => ['@type' => 'LearningResource', 'name' => $lesson->title, 'url' => $seo->url($lesson->href ?: '/lecons/'.$lesson->slug)])->values()->all(),
            ], fn ($value) => $value !== null));
        if ($course->status_publication !== 'published') {
            $seo->noindex();
        }
    }

    private function layerParam(Request $request, int $default): int
    {
        $value = (int) $request->query('couche', (string) $default);

        return $value >= 1 && $value <= 7 ? $value : $default;
    }
}
