<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Routine\StoreRoutineRequest;
use App\Http\Requests\Routine\UpdateRoutineRequest;
use App\Http\Resources\RoutineResource;
use App\Http\Resources\WorkoutSessionResource;
use App\Models\Routine;
use App\Models\RoutineDay;
use App\Models\WorkoutSession;
use App\Services\CatalogExerciseResolver;
use App\Services\TrainingCalendarPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
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
        CatalogExerciseResolver $catalogResolver
    ): JsonResponse
    {
        $payload = $request->validated();

        $weekdays = collect($payload['days'])->pluck('weekday');
        abort_if($weekdays->count() !== $weekdays->unique()->count(), 422, 'Cada día de la semana solo puede asignarse una vez.');

        $routine = DB::transaction(function () use ($request, $payload, $catalogResolver) {
            $routine = Routine::query()->create([
                'user_id' => $request->user()->id,
                'name' => $payload['name'],
                'description' => $payload['description'] ?? null,
                'sessions_per_week' => $payload['sessions_per_week'],
                'is_active' => $payload['is_active'] ?? true,
                'starts_on' => $payload['starts_on'] ?? null,
                'ends_on' => $payload['ends_on'] ?? null,
            ]);

            foreach ($payload['days'] as $dayPayload) {
                $day = $routine->days()->create([
                    'day_index' => $dayPayload['day_index'],
                    'weekday' => $dayPayload['weekday'],
                    'name' => $dayPayload['name'],
                    'focus' => $dayPayload['focus'] ?? null,
                    'notes' => $dayPayload['notes'] ?? null,
                ]);

                foreach ($dayPayload['exercises'] ?? [] as $index => $exercise) {
                    if (blank($exercise['name'] ?? null) && blank($exercise['catalog_exercise_id'] ?? null)) {
                        continue;
                    }

                    $catalog = $catalogResolver->resolve($request->user(), $exercise);

                    $day->exercises()->create([
                        'routine_id' => $routine->id,
                        'catalog_exercise_id' => $catalog->id,
                        'name' => $catalog->name,
                        'sort_order' => $exercise['sort_order'] ?? $index,
                        'default_sets' => $exercise['default_sets'] ?? $catalog->default_sets ?? 3,
                        'default_reps' => $exercise['default_reps'] ?? $catalog->default_reps ?? 10,
                        'rest_seconds' => $exercise['rest_seconds'] ?? $catalog->rest_seconds ?? 90,
                        'target_muscle' => $exercise['target_muscle'] ?? $catalog->target_muscle,
                        'notes' => $exercise['notes'] ?? $catalog->notes,
                    ]);
                }
            }

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
        $this->authorizeRoutine($routine);

        return new RoutineResource($routine->load('days.exercises'));
    }

    public function update(UpdateRoutineRequest $request, Routine $routine, TrainingCalendarPlanner $planner): RoutineResource
    {
        $this->authorizeRoutine($routine);

        $routine->update($request->validated());

        $syncFrom = now()->toDateString();
        $syncTo = $routine->ends_on?->toDateString() ?? now()->addDays(60)->toDateString();
        $planner->syncRange($request->user(), $syncFrom, $syncTo);

        return new RoutineResource($routine->fresh()->load('days.exercises'));
    }

    public function destroy(Routine $routine, TrainingCalendarPlanner $planner): JsonResponse
    {
        $this->authorizeRoutine($routine);
        $user = $routine->user;
        $routine->update(['is_active' => false]);
        $planner->syncRange($user, now()->toDateString(), now()->addDays(60)->toDateString());
        $routine->delete();

        return response()->json(['message' => 'Rutina eliminada.']);
    }

    public function history(Request $request, Routine $routine): AnonymousResourceCollection
    {
        $this->authorizeRoutine($routine);

        $sessions = WorkoutSession::query()
            ->with(['day', 'setLogs.routineExercise'])
            ->where('routine_id', $routine->id)
            ->where('user_id', $request->user()->id)
            ->where(function ($query) {
                $query->whereNotNull('completed_at')
                    ->orWhereHas('setLogs');
            })
            ->orderByDesc('scheduled_date')
            ->limit(40)
            ->get();

        return WorkoutSessionResource::collection($sessions);
    }

    public function copyDay(Request $request, Routine $routine, RoutineDay $day): RoutineResource
    {
        $this->authorizeRoutine($routine);
        abort_unless($day->routine_id === $routine->id, 404);

        $validated = $request->validate([
            'target_day_ids' => ['required', 'array', 'min:1'],
            'target_day_ids.*' => ['integer', 'exists:routine_days,id'],
            'replace' => ['sometimes', 'boolean'],
        ]);

        $sourceExercises = $day->exercises()->orderBy('sort_order')->get();

        DB::transaction(function () use ($routine, $validated, $sourceExercises) {
            $targets = RoutineDay::query()
                ->where('routine_id', $routine->id)
                ->whereIn('id', $validated['target_day_ids'])
                ->get();

            foreach ($targets as $target) {
                if ($validated['replace'] ?? true) {
                    $target->exercises()->delete();
                }

                $offset = (int) $target->exercises()->max('sort_order');

                foreach ($sourceExercises as $index => $exercise) {
                    $target->exercises()->create([
                        'routine_id' => $routine->id,
                        'catalog_exercise_id' => $exercise->catalog_exercise_id,
                        'name' => $exercise->name,
                        'sort_order' => $offset + $index + 1,
                        'default_sets' => $exercise->default_sets,
                        'default_reps' => $exercise->default_reps,
                        'rest_seconds' => $exercise->rest_seconds,
                        'target_muscle' => $exercise->target_muscle,
                        'notes' => $exercise->notes,
                    ]);
                }
            }
        });

        return new RoutineResource($routine->fresh()->load('days.exercises'));
    }

    private function authorizeRoutine(Routine $routine): void
    {
        abort_unless(
            $routine->user_id === auth()->id(),
            403,
            'No tienes acceso a esta rutina.'
        );
    }
}
