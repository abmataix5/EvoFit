<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogExerciseController;
use App\Http\Controllers\Api\EmailPreferenceController;
use App\Http\Controllers\Api\ExerciseHistoryController;
use App\Http\Controllers\Api\ExerciseLibraryController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PeopleController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ProgressController;
use App\Http\Controllers\Api\RoutineController;
use App\Http\Controllers\Api\WorkoutReportController;
use App\Http\Controllers\Api\WorkoutSessionController;
use App\Http\Controllers\Api\WorkoutSessionExerciseController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::middleware('throttle:6,1')->group(function (): void {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
    });

    // Baja de avisos desde el enlace firmado del email (no requiere sesión).
    Route::match(['get', 'post'], '/email/unsubscribe/{user}', [EmailPreferenceController::class, 'unsubscribe'])
        ->middleware(['signed', 'throttle:20,1'])
        ->name('email.unsubscribe');

    Route::middleware(['auth:sanctum', 'tenant', 'throttle:120,1'])->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::patch('/profile', [ProfileController::class, 'update']);
        Route::get('/profile/stats', [ProfileController::class, 'stats']);
        Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->middleware('throttle:6,1');
        Route::post('/profile/avatar', [ProfileController::class, 'updateAvatar'])->middleware('throttle:10,1');
        Route::delete('/profile/avatar', [ProfileController::class, 'destroyAvatar']);
        Route::get('/users/{user}/avatar', [ProfileController::class, 'avatar']);

        // Red social: personas, amistades y avisos.
        Route::get('/people/search', [PeopleController::class, 'search']);
        Route::get('/people/{user}', [PeopleController::class, 'show']);
        Route::get('/people/{user}/friends', [FriendController::class, 'ofUser']);
        Route::post('/people/{user}/block', [PeopleController::class, 'block']);
        Route::delete('/people/{user}/block', [PeopleController::class, 'unblock']);
        Route::post('/people/{user}/report', [PeopleController::class, 'report'])->middleware('throttle:10,1');

        Route::get('/friends', [FriendController::class, 'index']);
        Route::delete('/friends/{user}', [FriendController::class, 'destroy']);
        Route::get('/friend-requests', [FriendController::class, 'requests']);
        Route::post('/friend-requests', [FriendController::class, 'store'])->middleware('throttle:30,1');
        Route::post('/friend-requests/{friendship}/accept', [FriendController::class, 'accept']);
        Route::delete('/friend-requests/{friendship}', [FriendController::class, 'dismiss']);

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);

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
        Route::delete('/progress/body-weight/{bodyWeightEntry}', [ProgressController::class, 'destroyBodyWeight']);
        Route::get('/progress/photos/{progressPhoto}/image', [ProgressController::class, 'photoImage']);
        Route::delete('/progress/photos/{progressPhoto}', [ProgressController::class, 'destroyPhoto']);

        Route::get('/exercise-history', [ExerciseHistoryController::class, 'show']);

        // Generar un PDF cuesta más que una consulta: límite propio.
        Route::middleware('throttle:20,1')->group(function (): void {
            Route::get('/reports/workouts', [WorkoutReportController::class, 'range']);
            Route::get('/workout-sessions/{workoutSession}/report', [WorkoutReportController::class, 'session']);
        });
    });
});
