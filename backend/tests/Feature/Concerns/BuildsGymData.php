<?php

namespace Tests\Feature\Concerns;

use App\Models\CatalogExercise;
use App\Models\ExerciseSetLog;
use App\Models\Routine;
use App\Models\RoutineDay;
use App\Models\RoutineExercise;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkoutSession;
use Illuminate\Support\Str;

trait BuildsGymData
{
    protected function makeUser(string $name = 'Ana'): User
    {
        $tenant = Tenant::query()->create([
            'name' => $name.' · EvoFit',
            'slug' => Str::slug($name.'-'.Str::random(6)),
            'plan' => 'free',
        ]);

        return User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => $name,
            'role' => 'owner',
        ]);
    }

    protected function makeCatalog(User $user, string $name, array $attributes = []): CatalogExercise
    {
        return CatalogExercise::query()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'name' => $name,
            ...$attributes,
        ]);
    }

    /**
     * Rutina con un día (lunes) y los ejercicios dados (nombre => atributos).
     *
     * @param  array<string, array<string, mixed>>  $exercises
     * @return array{0: Routine, 1: RoutineDay, 2: array<string, RoutineExercise>}
     */
    protected function makeRoutine(User $user, array $exercises = ['Press banca' => []], int $weekday = 1): array
    {
        $routine = Routine::query()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'name' => 'Rutina de '.$user->name,
            'sessions_per_week' => 1,
            'is_active' => true,
        ]);

        $day = $this->makeDay($routine, 1, $weekday, 'Día A');

        $created = [];
        $order = 0;
        foreach ($exercises as $name => $attributes) {
            $catalog = $this->makeCatalog($user, $name, array_intersect_key($attributes, array_flip(['tracking_mode', 'time_direction'])));
            $created[$name] = $this->makeExercise($day, $name, $catalog->id, $order++, $attributes);
        }

        return [$routine, $day, $created];
    }

    protected function makeDay(Routine $routine, int $index, int $weekday, string $name): RoutineDay
    {
        return RoutineDay::query()->create([
            'tenant_id' => $routine->tenant_id,
            'routine_id' => $routine->id,
            'day_index' => $index,
            'weekday' => $weekday,
            'name' => $name,
        ]);
    }

    protected function makeExercise(RoutineDay $day, string $name, ?int $catalogId = null, int $order = 0, array $attributes = []): RoutineExercise
    {
        return RoutineExercise::query()->create([
            'tenant_id' => $day->tenant_id,
            'routine_id' => $day->routine_id,
            'routine_day_id' => $day->id,
            'catalog_exercise_id' => $catalogId,
            'name' => $name,
            'sort_order' => $order,
            ...$attributes,
        ]);
    }

    protected function makeSession(RoutineDay $day, string $scheduled, ?string $startedAt = null, array $attributes = []): WorkoutSession
    {
        $routine = $day->routine;

        return WorkoutSession::query()->create([
            'tenant_id' => $routine->tenant_id,
            'user_id' => $routine->user_id,
            'routine_id' => $routine->id,
            'routine_day_id' => $day->id,
            'scheduled_date' => $scheduled,
            'started_at' => $startedAt,
            'is_planned' => $startedAt === null,
            ...$attributes,
        ]);
    }

    protected function logSet(WorkoutSession $session, RoutineExercise $exercise, int $setNumber, ?float $kg, ?int $reps = null, array $attributes = []): ExerciseSetLog
    {
        return ExerciseSetLog::query()->create([
            'tenant_id' => $session->tenant_id,
            'workout_session_id' => $session->id,
            'routine_exercise_id' => $exercise->id,
            'set_number' => $setNumber,
            'weight_kg' => $kg,
            'reps' => $reps,
            'completed' => true,
            ...$attributes,
        ]);
    }
}
