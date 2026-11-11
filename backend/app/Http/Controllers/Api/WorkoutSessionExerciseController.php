<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workout\StoreSessionExerciseRequest;
use App\Http\Resources\WorkoutSessionResource;
use App\Models\RoutineExercise;
use App\Models\WorkoutSession;
use App\Services\PreviousSetLookup;
use App\Services\SessionExerciseChanger;

/**
 * Cambiar o añadir ejercicios en el entreno de un día, sin tocar la rutina.
 */
class WorkoutSessionExerciseController extends Controller
{
    public function store(
        StoreSessionExerciseRequest $request,
        WorkoutSession $workoutSession,
        SessionExerciseChanger $changer,
        PreviousSetLookup $previousSets,
    ): WorkoutSessionResource {
        $validated = $request->validated();

        $changer->add(
            $request->user(),
            $workoutSession,
            [
                'catalog_exercise_id' => $validated['catalog_exercise_id'] ?? null,
                'name' => $validated['name'] ?? null,
            ],
            isset($validated['replaces_routine_exercise_id']) ? (int) $validated['replaces_routine_exercise_id'] : null,
        );

        return $this->detail($workoutSession->fresh(), $previousSets);
    }

    public function destroy(
        WorkoutSession $workoutSession,
        RoutineExercise $routineExercise,
        SessionExerciseChanger $changer,
        PreviousSetLookup $previousSets,
    ): WorkoutSessionResource {
        $this->authorize('update', $workoutSession);

        $changer->remove($workoutSession, $routineExercise);

        return $this->detail($workoutSession->fresh(), $previousSets);
    }

    private function detail(WorkoutSession $session, PreviousSetLookup $previousSets): WorkoutSessionResource
    {
        $session->load(WorkoutSessionController::DETAIL_RELATIONS);
        $session->previousLifts = $previousSets->forSession($session);

        return new WorkoutSessionResource($session);
    }
}
