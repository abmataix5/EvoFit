<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProgressController;
use App\Http\Controllers\Api\RoutineController;
use App\Http\Controllers\Api\WorkoutSessionController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware(['auth:sanctum', 'tenant'])->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::apiResource('routines', RoutineController::class);
        Route::post('/routines/{routine}/days/{day}/copy', [RoutineController::class, 'copyDay']);
        Route::get('/routines/{routine}/history', [RoutineController::class, 'history']);

        Route::get('/workout-sessions/calendar', [WorkoutSessionController::class, 'calendar']);
        Route::post('/workout-sessions', [WorkoutSessionController::class, 'store']);
        Route::get('/workout-sessions/{workoutSession}', [WorkoutSessionController::class, 'show']);
        Route::patch('/workout-sessions/{workoutSession}', [WorkoutSessionController::class, 'update']);
        Route::put('/workout-sessions/{workoutSession}/logs', [WorkoutSessionController::class, 'syncLogs']);

        Route::get('/progress/body-weight', [ProgressController::class, 'bodyWeights']);
        Route::post('/progress/body-weight', [ProgressController::class, 'storeBodyWeight']);
        Route::get('/progress/photos', [ProgressController::class, 'photos']);
        Route::post('/progress/photos', [ProgressController::class, 'storePhoto']);
        Route::get('/progress/insights', [ProgressController::class, 'insights']);
    });
});
