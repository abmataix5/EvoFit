<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExerciseHistoryRequest;
use App\Models\RoutineExercise;
use App\Services\ExerciseHistoryService;
use Illuminate\Http\JsonResponse;

class ExerciseHistoryController extends Controller
{
    public function show(ExerciseHistoryRequest $request, ExerciseHistoryService $history): JsonResponse
    {
        // Incluye ejercicios archivados: su historial sigue siendo consultable.
        $exercise = RoutineExercise::query()
            ->with('routine')
            ->findOrFail($request->validated('routine_exercise_id'));

        abort_if($exercise->routine === null, 404);
        $this->authorize('view', $exercise->routine);

        return response()->json([
            'data' => $history->forExercise($request->user(), $exercise),
        ]);
    }
}
