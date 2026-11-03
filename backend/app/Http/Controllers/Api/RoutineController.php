<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Routine\CopyRoutineDayRequest;
use App\Http\Requests\Routine\StoreRoutineRequest;
use App\Http\Requests\Routine\UpdateRoutineRequest;
use App\Http\Resources\RoutineResource;
use App\Http\Resources\WorkoutSessionResource;
use App\Models\Routine;
use App\Models\RoutineDay;
use App\Models\WorkoutSession;
use App\Services\RoutineDaySync;
use App\Services\TrainingCalendarPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class RoutineController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $routines = Routine::query()
            ->with(['days.exercises'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('is_active')
            ->orderByDesc('starts_on')
            ->orderBy('name')
            ->get();

        return RoutineResource::collection($routines);
    }

    public function store(
        StoreRoutineRequest $request,
        TrainingCalendarPlanner $planner,
        RoutineDaySync $daySync
    ): JsonResponse {
        $payload = $request->validated();

        $routine = DB::transaction(function () use ($request, $payload, $daySync) {
            $routine = Routine::query()->create([
                'user_id' => $request->user()->id,
                'name' => $payload['name'],
                'description' => $payload['description'] ?? null,
                'sessions_per_week' => $payload['sessions_per_week'],
                'is_active' => $payload['is_active'] ?? true,
                'starts_on' => $payload['starts_on'] ?? null,
                'ends_on' => $payload['ends_on'] ?? null,
            ]);

            $daySync->sync($request->user(), $routine, $payload['days']);

            return $routine;
        });

        $syncFrom = $routine->starts_on?->toDateString() ?? now()->toDateString();
        $syncTo = $routine->ends_on?->toDateString() ?? now()->addDays(60)->toDateString();
        $planner->syncRange($request->user(), $syncFrom, $syncTo);

        return response()->json([
            'routine' => new RoutineResource($routine->load('days.exercises')),
        ], 201);
    }

    public function show(Routine $routine): RoutineResource
    {
        $this->authorize('view', $routine);

        return new RoutineResource($routine->load('days.exercises'));
    }

    public function update(
        UpdateRoutineRequest $request,
        Routine $routine,
        TrainingCalendarPlanner $planner,
        RoutineDaySync $daySync
    ): RoutineResource {
        $payload = $request->validated();
        $hasDays = array_key_exists('days', $payload);

        DB::transaction(function () use ($request, $routine, $payload, $hasDays, $daySync, $planner) {
            $routine->update(Arr::except($payload, ['days']));

            if ($hasDays) {
                $daySync->sync($request->user(), $routine, $payload['days']);
                // Las sesiones futuras sin tocar se replanifican con los nuevos días.
                $planner->resetFutureSessions($routine);
            }
        });

        $syncFrom = now()->toDateString();
        $syncTo = $routine->ends_on?->toDateString() ?? now()->addDays(60)->toDateString();
        if ($syncTo < $syncFrom) {
            $syncTo = $syncFrom;
        }
        $planner->syncRange($request->user(), $syncFrom, $syncTo);

        return new RoutineResource($routine->fresh()->load('days.exercises'));
    }

    public function destroy(Request $request, Routine $routine, TrainingCalendarPlanner $planner): JsonResponse
    {
        $this->authorize('delete', $routine);

        DB::transaction(function () use ($routine) {
            $routine->update(['is_active' => false]);
            $routine->delete();
        });

        $planner->syncRange($request->user(), now()->toDateString(), now()->addDays(60)->toDateString());

        return response()->json(['message' => 'Rutina eliminada.']);
    }

    public function history(Request $request, Routine $routine): AnonymousResourceCollection
    {
        $this->authorize('view', $routine);

        $sessions = WorkoutSession::query()
            ->with(['day' => fn ($query) => $query->withCount('exercises'), 'setLogs.routineExercise'])
            ->where('routine_id', $routine->id)
            ->where('user_id', $request->user()->id)
            ->where(function ($query) {
                $query->whereNotNull('completed_at')
                    ->orWhereHas('setLogs');
            })
            ->orderByRaw(WorkoutSession::trainedAtSql().' DESC')
            ->limit(40)
            ->get();

        return WorkoutSessionResource::collection($sessions);
    }

    public function copyDay(
        CopyRoutineDayRequest $request,
        Routine $routine,
        RoutineDay $day,
        RoutineDaySync $daySync
    ): RoutineResource {
        abort_unless($day->routine_id === $routine->id && $day->archived_at === null, 404);

        $validated = $request->validated();
        $sourceExercises = $day->exercises()->get();

        DB::transaction(function () use ($routine, $validated, $sourceExercises, $daySync) {
            $targets = $routine->days()
                ->whereIn('id', $validated['target_day_ids'])
                ->get();

            foreach ($targets as $target) {
                if ($validated['replace'] ?? true) {
                    // Lo que tenga series se archiva para no perder historial.
                    foreach ($target->exercises()->get() as $exercise) {
                        $daySync->removeExercise($exercise);
                    }
                }

                $offset = (int) $target->exercises()->max('sort_order');

                foreach ($sourceExercises as $index => $exercise) {
                    $target->exercises()->create([
                        'routine_id' => $routine->id,
                        'catalog_exercise_id' => $exercise->catalog_exercise_id,
                        'name' => $exercise->name,
                        'sort_order' => $offset + $index + 1,
                        'tracking_mode' => $exercise->tracking_mode,
                        'time_direction' => $exercise->time_direction,
                        'default_sets' => $exercise->default_sets,
                        'default_reps' => $exercise->default_reps,
                        'default_duration_seconds' => $exercise->default_duration_seconds,
                        'rest_seconds' => $exercise->rest_seconds,
                        'target_muscle' => $exercise->target_muscle,
                        'notes' => $exercise->notes,
                    ]);
                }
            }
        });

        return new RoutineResource($routine->fresh()->load('days.exercises'));
    }
}
