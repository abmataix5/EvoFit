<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workout\CalendarRequest;
use App\Http\Requests\Workout\StoreWorkoutSessionRequest;
use App\Http\Requests\Workout\SyncWorkoutLogsRequest;
use App\Http\Requests\Workout\UpdateWorkoutSessionRequest;
use App\Http\Resources\WorkoutSessionResource;
use App\Models\Routine;
use App\Models\RoutineDay;
use App\Models\WorkoutSession;
use App\Services\PreviousSetLookup;
use App\Services\TrainingCalendarPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class WorkoutSessionController extends Controller
{
    private const DETAIL_RELATIONS = ['routine', 'day.exercises', 'setLogs.routineExercise'];

    public function calendar(CalendarRequest $request, TrainingCalendarPlanner $planner): AnonymousResourceCollection
    {
        $validated = $request->validated();

        $planner->syncRange($request->user(), $validated['from'], $validated['to']);

        // Solo rutinas activas: las pausadas no aparecen en el calendario.
        $sessions = WorkoutSession::query()
            ->with(self::DETAIL_RELATIONS)
            ->where('user_id', $request->user()->id)
            ->whereDate('scheduled_date', '>=', $validated['from'])
            ->whereDate('scheduled_date', '<=', $validated['to'])
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

        $this->authorize('view', $routine);
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
            'session' => new WorkoutSessionResource($session->load(self::DETAIL_RELATIONS)),
        ], 201);
    }

    public function show(WorkoutSession $workoutSession, PreviousSetLookup $previousSets): WorkoutSessionResource
    {
        $this->authorize('view', $workoutSession);

        if ($workoutSession->started_at === null) {
            $workoutSession->update(['started_at' => now(), 'is_planned' => false]);
        }

        return $this->detail($workoutSession, $previousSets);
    }

    public function update(
        UpdateWorkoutSessionRequest $request,
        WorkoutSession $workoutSession,
        PreviousSetLookup $previousSets
    ): WorkoutSessionResource {
        $validated = $request->validated();

        DB::transaction(function () use ($workoutSession, $validated) {
            if (array_key_exists('notes', $validated)) {
                $workoutSession->update(['notes' => $validated['notes']]);
            }

            if (! array_key_exists('routine_day_id', $validated)) {
                return;
            }

            $day = RoutineDay::query()->whereNull('archived_at')->find($validated['routine_day_id']);
            abort_if($day === null, 422, 'Ese día no existe.');
            abort_unless($day->routine_id === $workoutSession->routine_id, 422, 'El día debe ser de la misma rutina.');

            if ($day->id === $workoutSession->routine_day_id) {
                return;
            }

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

        return $this->detail($workoutSession->fresh(), $previousSets);
    }

    public function syncLogs(
        SyncWorkoutLogsRequest $request,
        WorkoutSession $workoutSession,
        PreviousSetLookup $previousSets
    ): WorkoutSessionResource {
        $sets = $request->validated('sets') ?? [];
        $removals = $request->validated('remove_sets') ?? [];

        DB::transaction(function () use ($request, $workoutSession, $sets, $removals) {
            foreach ($removals as $removal) {
                $workoutSession->setLogs()
                    ->where('routine_exercise_id', $removal['routine_exercise_id'])
                    ->where('set_number', $removal['set_number'])
                    ->delete();
            }

            foreach ($sets as $set) {
                $values = [
                    'weight_kg' => $set['weight_kg'] ?? null,
                    'reps' => $set['reps'] ?? null,
                    'duration_seconds' => ! empty($set['duration_seconds']) ? (int) $set['duration_seconds'] : null,
                    'completed' => array_key_exists('completed', $set) ? (bool) $set['completed'] : true,
                ];
                // rpe/notes solo se tocan si vienen en la petición (el autosave puede no enviarlos).
                if (array_key_exists('rpe', $set)) {
                    $values['rpe'] = $set['rpe'] !== null ? round((float) $set['rpe'], 1) : null;
                }
                if (array_key_exists('notes', $set)) {
                    $values['notes'] = blank($set['notes']) ? null : trim((string) $set['notes']);
                }

                $workoutSession->setLogs()->updateOrCreate(
                    [
                        'routine_exercise_id' => $set['routine_exercise_id'],
                        'set_number' => $set['set_number'],
                    ],
                    $values
                );
            }

            if ($request->boolean('complete')) {
                $workoutSession->update([
                    'completed_at' => now(),
                    'is_planned' => false,
                ]);
            }
        });

        return $this->detail($workoutSession->fresh(), $previousSets);
    }

    private function detail(WorkoutSession $session, PreviousSetLookup $previousSets): WorkoutSessionResource
    {
        $session->load(self::DETAIL_RELATIONS);
        $session->previousLifts = $previousSets->forSession($session);

        return new WorkoutSessionResource($session);
    }
}
