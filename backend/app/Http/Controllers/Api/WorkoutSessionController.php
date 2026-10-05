<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workout\StoreWorkoutSessionRequest;
use App\Http\Requests\Workout\SyncWorkoutLogsRequest;
use App\Http\Resources\WorkoutSessionResource;
use App\Models\Routine;
use App\Models\RoutineDay;
use App\Models\WorkoutSession;
use App\Services\PreviousSetLookup;
use App\Services\TrainingCalendarPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class WorkoutSessionController extends Controller
{
    public function calendar(Request $request, TrainingCalendarPlanner $planner): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $planner->syncRange($request->user(), $validated['from'], $validated['to']);

        // Solo rutinas activas: las pausadas no aparecen en el calendario.
        $sessions = WorkoutSession::query()
            ->with(['routine', 'day.exercises', 'setLogs.routineExercise'])
            ->where('user_id', $request->user()->id)
            ->whereBetween('scheduled_date', [$validated['from'], $validated['to']])
            ->whereHas('routine', fn ($q) => $q->where('is_active', true))
            ->orderBy('scheduled_date')
            ->get();

        return WorkoutSessionResource::collection($sessions);
    }

    public function store(StoreWorkoutSessionRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $routine = Routine::query()->findOrFail($payload['routine_id']);
        $day = RoutineDay::query()->findOrFail($payload['routine_day_id']);

        abort_unless($routine->user_id === $request->user()->id, 403);
        abort_unless($day->routine_id === $routine->id, 422, 'El día no pertenece a esa rutina.');

        $session = WorkoutSession::query()->firstOrCreate(
            [
                'user_id' => $request->user()->id,
                'routine_day_id' => $day->id,
                'scheduled_date' => $payload['scheduled_date'],
            ],
            [
                'routine_id' => $routine->id,
                'started_at' => now(),
                'is_planned' => false,
            ]
        );

        if ($session->started_at === null) {
            $session->update(['started_at' => now(), 'is_planned' => false]);
        }

        return response()->json([
            'session' => new WorkoutSessionResource(
                $session->load(['routine', 'day.exercises', 'setLogs.routineExercise'])
            ),
        ], 201);
    }

    public function show(WorkoutSession $workoutSession, PreviousSetLookup $previousSets): WorkoutSessionResource
    {
        $this->authorizeSession($workoutSession);

        if ($workoutSession->started_at === null) {
            $workoutSession->update(['started_at' => now(), 'is_planned' => false]);
        }

        $workoutSession->load(['routine', 'day.exercises', 'setLogs.routineExercise']);
        $workoutSession->previousLifts = $previousSets->forSession($workoutSession);

        return new WorkoutSessionResource($workoutSession);
    }

    public function update(Request $request, WorkoutSession $workoutSession): WorkoutSessionResource
    {
        $this->authorizeSession($workoutSession);

        $validated = $request->validate([
            'routine_day_id' => ['required', 'integer', 'exists:routine_days,id'],
        ]);

        $day = RoutineDay::query()->findOrFail($validated['routine_day_id']);
        abort_unless($day->routine_id === $workoutSession->routine_id, 422, 'El día debe ser de la misma rutina.');

        DB::transaction(function () use ($workoutSession, $day) {
            $conflict = WorkoutSession::query()
                ->where('user_id', $workoutSession->user_id)
                ->where('routine_day_id', $day->id)
                ->whereDate('scheduled_date', $workoutSession->scheduled_date)
                ->where('id', '!=', $workoutSession->id)
                ->first();

            if ($conflict !== null) {
                if ($conflict->setLogs()->exists() || $conflict->completed_at !== null) {
                    abort(422, 'Ya hay una sesión de ese día ese mismo fecha con datos.');
                }
                $conflict->delete();
            }

            $workoutSession->update([
                'routine_day_id' => $day->id,
                'was_swapped' => true,
                'is_planned' => false,
            ]);
        });

        return new WorkoutSessionResource(
            $workoutSession->fresh()->load(['routine', 'day.exercises', 'setLogs.routineExercise'])
        );
    }

    public function syncLogs(
        SyncWorkoutLogsRequest $request,
        WorkoutSession $workoutSession,
        PreviousSetLookup $previousSets
    ): WorkoutSessionResource
    {
        $this->authorizeSession($workoutSession);

        foreach ($request->validated('sets') as $set) {
            $workoutSession->setLogs()->updateOrCreate(
                [
                    'routine_exercise_id' => $set['routine_exercise_id'],
                    'set_number' => $set['set_number'],
                ],
                [
                    'weight_kg' => $set['weight_kg'] ?? null,
                    'reps' => $set['reps'] ?? null,
                    'completed' => $set['completed'] ?? true,
                ]
            );
        }

        if ($request->boolean('complete')) {
            $workoutSession->update([
                'completed_at' => now(),
                'is_planned' => false,
            ]);
        }

        $fresh = $workoutSession->fresh()->load(['routine', 'day.exercises', 'setLogs.routineExercise']);
        $fresh->previousLifts = $previousSets->forSession($fresh);

        return new WorkoutSessionResource($fresh);
    }

    private function authorizeSession(WorkoutSession $session): void
    {
        abort_unless($session->user_id === auth()->id(), 403);
    }
}
