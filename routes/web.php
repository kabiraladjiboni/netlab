<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Api\AssistantController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\TermController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\TwoFactorChallengeController;
use App\Http\Controllers\Learning\LabController;
use App\Http\Controllers\Learning\LearningApiController;
use App\Http\Controllers\LessonController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\ProtocolController;
use App\Http\Controllers\Student\AccountController;
use App\Http\Controllers\Student\StudentController;
use App\Http\Controllers\Student\TwoFactorController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| 1. Site public (sans compte)
|--------------------------------------------------------------------------
*/
Route::get('/robots.txt', [\App\Http\Controllers\SeoController::class, 'robots'])->name('seo.robots');
Route::get('/sitemap.xml', [\App\Http\Controllers\SeoController::class, 'sitemap'])->name('seo.sitemap');
Route::get('/site.webmanifest', [\App\Http\Controllers\SeoController::class, 'manifest'])->name('seo.manifest');
Route::get('/.well-known/security.txt', [\App\Http\Controllers\SeoController::class, 'securityTxt'])->name('seo.security');

Route::get('/', [PageController::class, 'home'])->name('home');
Route::get('/apprendre', [PageController::class, 'learn'])->name('learn');
Route::get('/cours/{slug}', [PageController::class, 'course'])->name('courses.show');
Route::get('/lecons/{slug}', [LessonController::class, 'show'])->name('lessons.show');

Route::get('/protocoles', [ProtocolController::class, 'index'])->name('protocols.index');
Route::get('/protocoles/{slug}', [ProtocolController::class, 'show'])->name('protocols.show');

Route::get('/modeles/osi', [PageController::class, 'osi'])->name('models.osi');
Route::get('/modeles/tcp-ip', [PageController::class, 'tcpip'])->name('models.tcpip');
Route::get('/reseaux', [PageController::class, 'networks'])->name('networks');
Route::get('/equipements', [PageController::class, 'equipment'])->name('equipment');
Route::get('/segmentation', [PageController::class, 'segmentation'])->name('segmentation');

Route::get('/wireshark', [PageController::class, 'wireshark'])->name('wireshark');
Route::get('/diagnostic', [PageController::class, 'diagnostics'])->name('diagnostics.index');
Route::get('/diagnostic/{slug}', [PageController::class, 'diagnostic'])->name('diagnostics.show');
Route::get('/quiz', [PageController::class, 'quizzes'])->name('quizzes.index');
Route::get('/quiz/{slug}', [PageController::class, 'quiz'])->name('quizzes.show');
Route::get('/dictionnaire/{slug?}', [PageController::class, 'glossary'])->name('glossary');
Route::get('/laboratoire', [LabController::class, 'index'])->name('lab.index');

Route::get('/confidentialite', [PageController::class, 'privacy'])->name('legal.privacy');
Route::get('/conditions', [PageController::class, 'terms'])->name('legal.terms');
Route::get('/notre-histoire', [PageController::class, 'story'])->name('story');

/*
|--------------------------------------------------------------------------
| 2. Authentification
|--------------------------------------------------------------------------
*/
Route::middleware('guest')->group(function () {
    Route::get('/connexion', [LoginController::class, 'create'])->name('login');
    Route::post('/connexion', [LoginController::class, 'store'])->middleware('throttle:login');
    Route::get('/connexion/verification', [TwoFactorChallengeController::class, 'create'])->name('two-factor.challenge');
    Route::post('/connexion/verification', [TwoFactorChallengeController::class, 'store'])->middleware('throttle:login');
    Route::get('/inscription', [RegisterController::class, 'create'])->name('register');
    Route::post('/inscription', [RegisterController::class, 'store'])->middleware('throttle:register');
    Route::get('/mot-de-passe-oublie', [PasswordResetController::class, 'request'])->name('password.request');
    Route::post('/mot-de-passe-oublie', [PasswordResetController::class, 'email'])->middleware('throttle:password-reset')->name('password.email');
    Route::get('/reinitialiser-mot-de-passe/{token}', [PasswordResetController::class, 'edit'])->name('password.reset');
    Route::post('/reinitialiser-mot-de-passe', [PasswordResetController::class, 'update'])->middleware('throttle:password-reset')->name('password.update');
});

// Lien de confirmation : accessible sans session (signature + empreinte de l'adresse).
Route::get('/email/verification/{id}/{hash}', [EmailVerificationController::class, 'verify'])->middleware(['signed', 'throttle:6,1'])->name('verification.verify');

Route::middleware('auth')->group(function () {
    Route::post('/deconnexion', [LoginController::class, 'destroy'])->name('logout');
    Route::get('/email/verification', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::post('/email/verification/renvoyer', [EmailVerificationController::class, 'resend'])->middleware('throttle:6,1')->name('verification.send');
});

/*
|--------------------------------------------------------------------------
| 3. Espace étudiant (compte requis)
|--------------------------------------------------------------------------
*/
Route::middleware('auth')->prefix('app')->name('student.')->group(function () {
    Route::get('/', [StudentController::class, 'dashboard'])->name('dashboard');
    Route::get('/ma-progression', [StudentController::class, 'progress'])->name('progress');
    Route::get('/mes-favoris', [StudentController::class, 'favorites'])->name('favorites');
    Route::get('/mes-resultats', [StudentController::class, 'results'])->name('results');
    Route::get('/mon-historique', [StudentController::class, 'history'])->name('history');
    Route::get('/mon-profil', [AccountController::class, 'profile'])->name('profile');
    Route::patch('/mon-profil', [AccountController::class, 'updateProfile'])->name('profile.update');
    Route::put('/mon-profil/mot-de-passe', [AccountController::class, 'updatePassword'])->middleware('throttle:6,1')->name('password.update');
    Route::get('/parametres', [AccountController::class, 'settings'])->name('settings');
    Route::patch('/parametres', [AccountController::class, 'updatePreferences'])->name('settings.update');
    Route::get('/parametres/export', [AccountController::class, 'export'])->middleware('throttle:5,1')->name('export');
    Route::delete('/parametres/compte', [AccountController::class, 'destroy'])->middleware('throttle:5,1')->name('destroy');
    // Sécurité du compte : double authentification.
    Route::get('/securite', [TwoFactorController::class, 'show'])->name('security');
    Route::middleware('throttle:6,1')->group(function () {
        Route::post('/securite/2fa', [TwoFactorController::class, 'start'])->name('security.2fa.start');
        Route::post('/securite/2fa/confirmer', [TwoFactorController::class, 'confirm'])->name('security.2fa.confirm');
        Route::post('/securite/2fa/annuler', [TwoFactorController::class, 'cancel'])->name('security.2fa.cancel');
        Route::post('/securite/2fa/codes', [TwoFactorController::class, 'recoveryCodes'])->name('security.2fa.codes');
        Route::delete('/securite/2fa', [TwoFactorController::class, 'destroy'])->name('security.2fa.destroy');
    });
});

/*
|--------------------------------------------------------------------------
| 4. Laboratoire (TP interactifs : compte requis, e-mail vérifié selon réglage)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'lab'])->prefix('laboratoire')->name('lab.')->group(function () {
    Route::get('/{slug}', [LabController::class, 'show'])->name('show');
    Route::get('/{slug}/resultats', [LabController::class, 'results'])->name('results');
});

/*
|--------------------------------------------------------------------------
| 5. API (session Web + jeton CSRF)
|--------------------------------------------------------------------------
*/
Route::prefix('api')->group(function () {
    Route::get('/recherche', SearchController::class)->middleware('throttle:search')->name('api.search');
    Route::get('/termes/{slug}', TermController::class)->name('api.terms.show');
    Route::post('/assistant', AssistantController::class)->middleware('throttle:assistant')->name('api.assistant');
    Route::post('/presence', [LearningApiController::class, 'presence'])->middleware('throttle:presence')->name('api.presence');
    Route::post('/consentement', [LearningApiController::class, 'consent'])->middleware('throttle:20,1')->name('api.consent');

    Route::middleware(['auth', 'throttle:learning'])->group(function () {
        Route::post('/quiz-attempts', [LearningApiController::class, 'quizAttempt'])->name('api.quiz-attempts');
        Route::post('/favoris', [LearningApiController::class, 'toggleFavorite'])->name('api.favorites');
        Route::put('/evaluations', [LearningApiController::class, 'rate'])->name('api.ratings');
        Route::post('/retours', [LearningApiController::class, 'feedback'])->middleware('throttle:feedback')->name('api.feedback');
    });

    Route::middleware(['auth', 'lab', 'throttle:learning'])->group(function () {
        Route::post('/labs/{slug}/sessions', [LearningApiController::class, 'startLab'])->name('api.labs.start');
        Route::patch('/lab-sessions/{id}', [LearningApiController::class, 'updateLab'])->whereNumber('id')->name('api.labs.update');
        Route::post('/diagnostics/{slug}/indice', [LearningApiController::class, 'diagnosticHint'])->name('api.diagnostics.hint');
        Route::post('/diagnostics/{slug}/reponse', [LearningApiController::class, 'diagnosticAnswer'])->name('api.diagnostics.answer');
    });
});

/*
|--------------------------------------------------------------------------
| 6. Administration (contrôle du rôle côté serveur sur TOUTES les routes)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'admin', \App\Http\Middleware\RequireAdminTwoFactor::class])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [Admin\DashboardController::class, 'index'])->name('dashboard');
    Route::get('/audience', [Admin\AnalyticsController::class, 'audience'])->name('audience');
    Route::get('/apprentissage', [Admin\AnalyticsController::class, 'learning'])->name('learning');
    Route::get('/export/{report}', [Admin\AnalyticsController::class, 'export'])->whereIn('report', ['indicateurs', 'contenus', 'pays'])->name('export');

    Route::get('/utilisateurs', [Admin\UserController::class, 'index'])->name('users.index');
    Route::get('/utilisateurs/export', [Admin\UserController::class, 'export'])->name('users.export');
    Route::get('/utilisateurs/{user}', [Admin\UserController::class, 'show'])->name('users.show');
    Route::post('/utilisateurs/{user}/suspendre', [Admin\UserController::class, 'suspend'])->name('users.suspend');
    Route::post('/utilisateurs/{user}/reactiver', [Admin\UserController::class, 'reactivate'])->name('users.reactivate');
    Route::post('/utilisateurs/{user}/role', [Admin\UserController::class, 'role'])->name('users.role');
    Route::post('/utilisateurs/{user}/verification', [Admin\UserController::class, 'resendVerification'])->name('users.verification');
    Route::delete('/utilisateurs/{user}', [Admin\UserController::class, 'destroy'])->name('users.destroy');

    Route::get('/cours', [Admin\CourseController::class, 'index'])->name('courses.index');
    Route::post('/cours', [Admin\CourseController::class, 'store'])->name('courses.store');
    Route::put('/cours/{course}', [Admin\CourseController::class, 'update'])->name('courses.update');
    Route::post('/cours/{course}/ordre', [Admin\CourseController::class, 'reorder'])->name('courses.reorder');
    Route::delete('/cours/{course}', [Admin\CourseController::class, 'destroy'])->name('courses.destroy');

    Route::get('/chapitres/nouveau', [Admin\LessonController::class, 'create'])->name('lessons.create');
    Route::post('/chapitres', [Admin\LessonController::class, 'store'])->name('lessons.store');
    Route::get('/chapitres/{lesson}', [Admin\LessonController::class, 'edit'])->name('lessons.edit');
    Route::put('/chapitres/{lesson}', [Admin\LessonController::class, 'update'])->name('lessons.update');
    Route::delete('/chapitres/{lesson}', [Admin\LessonController::class, 'destroy'])->name('lessons.destroy');

    Route::get('/protocoles', [Admin\ProtocolController::class, 'index'])->name('protocols.index');
    Route::get('/protocoles/nouveau', [Admin\ProtocolController::class, 'create'])->name('protocols.create');
    Route::post('/protocoles', [Admin\ProtocolController::class, 'store'])->name('protocols.store');
    Route::get('/protocoles/{protocol}', [Admin\ProtocolController::class, 'edit'])->name('protocols.edit');
    Route::put('/protocoles/{protocol}', [Admin\ProtocolController::class, 'update'])->name('protocols.update');
    Route::delete('/protocoles/{protocol}', [Admin\ProtocolController::class, 'destroy'])->name('protocols.destroy');

    Route::get('/glossaire', [Admin\TermController::class, 'index'])->name('terms.index');
    Route::get('/glossaire/nouveau', [Admin\TermController::class, 'create'])->name('terms.create');
    Route::post('/glossaire', [Admin\TermController::class, 'store'])->name('terms.store');
    Route::get('/glossaire/{term}', [Admin\TermController::class, 'edit'])->name('terms.edit');
    Route::put('/glossaire/{term}', [Admin\TermController::class, 'update'])->name('terms.update');
    Route::delete('/glossaire/{term}', [Admin\TermController::class, 'destroy'])->name('terms.destroy');

    Route::get('/scenarios', [Admin\ScenarioController::class, 'index'])->name('scenarios.index');
    Route::get('/scenarios/nouveau', [Admin\ScenarioController::class, 'create'])->name('scenarios.create');
    Route::post('/scenarios', [Admin\ScenarioController::class, 'store'])->name('scenarios.store');
    Route::get('/scenarios/{scenario}', [Admin\ScenarioController::class, 'edit'])->name('scenarios.edit');
    Route::put('/scenarios/{scenario}', [Admin\ScenarioController::class, 'update'])->name('scenarios.update');
    Route::post('/scenarios/{scenario}/publication', [Admin\ScenarioController::class, 'publication'])->name('scenarios.publication');
    Route::delete('/scenarios/{scenario}', [Admin\ScenarioController::class, 'destroy'])->name('scenarios.destroy');

    Route::get('/quiz', [Admin\QuizController::class, 'index'])->name('quizzes.index');
    Route::get('/quiz/nouveau', [Admin\QuizController::class, 'create'])->name('quizzes.create');
    Route::post('/quiz', [Admin\QuizController::class, 'store'])->name('quizzes.store');
    Route::get('/quiz/{quiz}', [Admin\QuizController::class, 'edit'])->name('quizzes.edit');
    Route::put('/quiz/{quiz}', [Admin\QuizController::class, 'update'])->name('quizzes.update');
    Route::delete('/quiz/{quiz}', [Admin\QuizController::class, 'destroy'])->name('quizzes.destroy');

    Route::get('/diagnostics', [Admin\DiagnosticController::class, 'index'])->name('diagnostics.index');
    Route::get('/diagnostics/nouveau', [Admin\DiagnosticController::class, 'create'])->name('diagnostics.create');
    Route::post('/diagnostics', [Admin\DiagnosticController::class, 'store'])->name('diagnostics.store');
    Route::get('/diagnostics/{diagnostic}', [Admin\DiagnosticController::class, 'edit'])->name('diagnostics.edit');
    Route::put('/diagnostics/{diagnostic}', [Admin\DiagnosticController::class, 'update'])->name('diagnostics.update');
    Route::delete('/diagnostics/{diagnostic}', [Admin\DiagnosticController::class, 'destroy'])->name('diagnostics.destroy');

    Route::get('/retours', [Admin\FeedbackController::class, 'index'])->name('feedback.index');
    Route::put('/retours/{report}', [Admin\FeedbackController::class, 'update'])->name('feedback.update');
    Route::get('/evaluations', [Admin\RatingController::class, 'index'])->name('ratings.index');
    Route::put('/evaluations/{rating}/moderation', [Admin\RatingController::class, 'moderate'])->name('ratings.moderate');

    Route::get('/journal', [Admin\LogController::class, 'index'])->name('logs.index');
    Route::get('/parametres', [Admin\SettingsController::class, 'edit'])->name('settings.edit');
    Route::put('/parametres', [Admin\SettingsController::class, 'update'])->name('settings.update');
    Route::post('/parametres/logo', [Admin\SettingsController::class, 'logo'])->name('settings.logo');
});
