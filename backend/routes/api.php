<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogExerciseController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\EmailPreferenceController;
use App\Http\Controllers\Api\ExerciseHistoryController;
use App\Http\Controllers\Api\ExerciseLibraryController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\LeagueController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PeopleController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\PostInteractionController;
use App\Http\Controllers\Api\PricingController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ProgressController;
use App\Http\Controllers\Api\RoutineController;
use App\Http\Controllers\Api\StoryController;
use App\Http\Controllers\Api\WorkoutReportController;
use App\Http\Controllers\Api\WorkoutSessionController;
use App\Http\Controllers\Api\WorkoutSessionExerciseController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    // Cada límite lleva su propio prefijo: sin él, todos comparten el mismo contador por
    // usuario y un límite estricto (p. ej. 20/min al publicar) cuenta TODAS sus peticiones.
    Route::middleware('throttle:6,1,auth')->group(function (): void {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
    });

    // Recuperar la contraseña por email (sin sesión). Límite propio y estricto.
    Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:5,1,password-forgot');
    Route::post('/auth/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:10,1,password-reset');

    // Página pública de precios: plazas gratis que quedan (sin sesión).
    Route::get('/pricing', [PricingController::class, 'show'])->middleware('throttle:60,1,pricing');

    // Baja de avisos desde el enlace firmado del email (no requiere sesión).
    Route::match(['get', 'post'], '/email/unsubscribe/{user}', [EmailPreferenceController::class, 'unsubscribe'])
        ->middleware(['signed', 'throttle:20,1,unsubscribe'])
        ->name('email.unsubscribe');

    // Imágenes (avatares, fotos de entrenos, historias y progreso): un feed o un perfil piden
    // muchas de golpe, así que llevan su propio contador y no gastan el de la API.
    // Se entra con sesión, con token o con la dirección firmada que reciben las apps.
    Route::middleware(['media.auth', 'tenant', 'throttle:600,1,media'])->group(function (): void {
        Route::get('/users/{user}/avatar', [ProfileController::class, 'avatar'])->name('media.avatar');
        Route::get('/posts/{post}/photo', [PostController::class, 'photo'])->name('media.post');
        Route::get('/stories/{story}/photo', [StoryController::class, 'photo'])->name('media.story');
        Route::get('/progress/photos/{progressPhoto}/image', [ProgressController::class, 'photoImage'])->name('media.progress');
    });

    Route::middleware(['auth:sanctum', 'tenant', 'throttle:120,1,api'])->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::patch('/profile', [ProfileController::class, 'update']);
        Route::delete('/profile', [ProfileController::class, 'destroy'])->middleware('throttle:6,1,password');
        Route::get('/profile/stats', [ProfileController::class, 'stats']);
        Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->middleware('throttle:6,1,password');
        Route::post('/profile/avatar', [ProfileController::class, 'updateAvatar'])->middleware('throttle:10,1,avatar');
        Route::delete('/profile/avatar', [ProfileController::class, 'destroyAvatar']);

        // Red social: personas, amistades y avisos.
        Route::get('/people/search', [PeopleController::class, 'search']);
        Route::get('/people/{user}', [PeopleController::class, 'show']);
        Route::get('/people/{user}/friends', [FriendController::class, 'ofUser']);
        Route::post('/people/{user}/block', [PeopleController::class, 'block']);
        Route::delete('/people/{user}/block', [PeopleController::class, 'unblock']);
        Route::post('/people/{user}/report', [PeopleController::class, 'report'])->middleware('throttle:10,1,report');

        Route::get('/friends', [FriendController::class, 'index']);
        Route::delete('/friends/{user}', [FriendController::class, 'destroy']);
        Route::get('/friend-requests', [FriendController::class, 'requests']);
        Route::post('/friend-requests', [FriendController::class, 'store'])->middleware('throttle:30,1,friend-request');
        Route::post('/friend-requests/{friendship}/accept', [FriendController::class, 'accept']);
        Route::delete('/friend-requests/{friendship}', [FriendController::class, 'dismiss']);

        // Liga semanal entre amigos.
        Route::get('/league', [LeagueController::class, 'show']);
        Route::get('/league/history', [LeagueController::class, 'history']);

        // Feed: entrenos compartidos, "me gusta" y comentarios.
        Route::get('/feed', [PostController::class, 'feed']);
        Route::get('/people/{user}/posts', [PostController::class, 'ofUser']);
        Route::post('/workout-sessions/{workoutSession}/share', [PostController::class, 'share'])->middleware('throttle:20,1,post-write');
        Route::get('/posts/{post}', [PostController::class, 'show']);
        Route::post('/posts/{post}', [PostController::class, 'update'])->middleware('throttle:20,1,post-write');
        Route::delete('/posts/{post}', [PostController::class, 'destroy']);
        Route::get('/posts/{post}/likes', [PostController::class, 'likers']);
        Route::post('/posts/{post}/like', [PostInteractionController::class, 'like']);
        Route::delete('/posts/{post}/like', [PostInteractionController::class, 'unlike']);
        Route::get('/posts/{post}/comments', [PostInteractionController::class, 'comments']);
        Route::post('/posts/{post}/comments', [PostInteractionController::class, 'comment'])->middleware('throttle:30,1,comment');
        Route::delete('/comments/{comment}', [PostInteractionController::class, 'destroyComment']);

        // Historias de 24 h.
        Route::get('/stories', [StoryController::class, 'index']);
        Route::get('/stories/stickers', [StoryController::class, 'stickers']);
        Route::post('/stories', [StoryController::class, 'store'])->middleware('throttle:20,1,story-write');
        Route::delete('/stories/{story}', [StoryController::class, 'destroy']);
        Route::post('/stories/{story}/view', [StoryController::class, 'view']);
        Route::get('/stories/{story}/viewers', [StoryController::class, 'viewers']);
        Route::post('/stories/{story}/reply', [StoryController::class, 'reply'])->middleware('throttle:60,1,message');

        // Mensajes privados entre amigos.
        Route::get('/conversations', [ConversationController::class, 'index']);
        Route::get('/conversations/unread-count', [ConversationController::class, 'unreadCount']);
        Route::post('/conversations', [ConversationController::class, 'open']);
        Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
        Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
        Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'send'])->middleware('throttle:60,1,message');
        Route::post('/conversations/{conversation}/read', [ConversationController::class, 'read']);

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
        Route::delete('/notifications', [NotificationController::class, 'destroyAll']);
        Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

        Route::apiResource('routines', RoutineController::class);
        Route::post('/routines/{routine}/days/{day}/copy', [RoutineController::class, 'copyDay']);
        Route::get('/routines/{routine}/history', [RoutineController::class, 'history']);

        Route::get('/exercises', [ExerciseLibraryController::class, 'index']);
        Route::get('/catalog-exercises', [CatalogExerciseController::class, 'index']);
        Route::post('/catalog-exercises', [CatalogExerciseController::class, 'store']);
        Route::patch('/catalog-exercises/{catalog_exercise}', [CatalogExerciseController::class, 'update']);
        Route::delete('/catalog-exercises/{catalog_exercise}', [CatalogExerciseController::class, 'destroy']);

        Route::get('/workout-sessions/calendar', [WorkoutSessionController::class, 'calendar']);
        Route::post('/workout-sessions', [WorkoutSessionController::class, 'store']);
        Route::get('/workout-sessions/{workoutSession}', [WorkoutSessionController::class, 'show']);
        Route::patch('/workout-sessions/{workoutSession}', [WorkoutSessionController::class, 'update']);
        Route::put('/workout-sessions/{workoutSession}/logs', [WorkoutSessionController::class, 'syncLogs']);
        Route::post('/workout-sessions/{workoutSession}/exercises', [WorkoutSessionExerciseController::class, 'store']);
        Route::delete('/workout-sessions/{workoutSession}/exercises/{routineExercise}', [WorkoutSessionExerciseController::class, 'destroy']);

        Route::get('/progress/body-weight', [ProgressController::class, 'bodyWeights']);
        Route::post('/progress/body-weight', [ProgressController::class, 'storeBodyWeight']);
        Route::get('/progress/photos', [ProgressController::class, 'photos']);
        Route::post('/progress/photos', [ProgressController::class, 'storePhoto']);
        Route::get('/progress/insights', [ProgressController::class, 'insights']);
        Route::get('/progress/highlights', [ProgressController::class, 'highlights']);
        Route::get('/progress/muscles', [ProgressController::class, 'muscles']);
        Route::get('/progress/overview', [ProgressController::class, 'overview']);
        Route::delete('/progress/body-weight/{bodyWeightEntry}', [ProgressController::class, 'destroyBodyWeight']);
        Route::delete('/progress/photos/{progressPhoto}', [ProgressController::class, 'destroyPhoto']);

        Route::get('/exercise-history', [ExerciseHistoryController::class, 'show']);

        // Generar un PDF cuesta más que una consulta: límite propio.
        Route::middleware('throttle:20,1,pdf')->group(function (): void {
            Route::get('/reports/workouts', [WorkoutReportController::class, 'range']);
            Route::get('/workout-sessions/{workoutSession}/report', [WorkoutReportController::class, 'session']);
        });
    });
});
