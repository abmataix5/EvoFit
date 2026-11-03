<?php

namespace App\Services;

use App\Models\Routine;
use App\Models\RoutineDay;
use App\Models\RoutineExercise;
use App\Models\User;
use App\Models\WorkoutSession;

/**
 * Crea/actualiza los días y ejercicios de una rutina a partir del payload
 * (mismo formato que al crearla, con `id` opcional en días y ejercicios).
 *
 * Lo que tiene historial (series registradas) se archiva en vez de borrarse.
 * Debe llamarse dentro de una transacción.
 */
class RoutineDaySync
{
    public function __construct(private readonly CatalogExerciseResolver $catalogResolver) {}

    /**
     * @param  array<int, array<string, mixed>>  $daysPayload
     */
    public function sync(User $user, Routine $routine, array $daysPayload): void
    {
        $existingDays = $routine->days()->get()->keyBy('id');
        $existingExercises = $routine->allExercises()->whereNull('archived_at')->get()->keyBy('id');

        $keptDayIds = [];
        $keptExerciseIds = [];

        // validated() reconstruye los arrays regla a regla: los elementos con `id` quedan
        // delante de los nuevos aunque conserven su índice. El orden real es el del índice.
        ksort($daysPayload);

        foreach ($daysPayload as $dayPayload) {
            $attributes = [
                'day_index' => $dayPayload['day_index'],
                'weekday' => $dayPayload['weekday'],
                'name' => $dayPayload['name'],
                'focus' => $dayPayload['focus'] ?? null,
                'notes' => $dayPayload['notes'] ?? null,
            ];

            $dayId = $dayPayload['id'] ?? null;
            if ($dayId !== null && $existingDays->has($dayId)) {
                $day = $existingDays->get($dayId);
                $day->update($attributes);
            } else {
                $day = $routine->days()->create($attributes);
            }
            $keptDayIds[] = $day->id;

            $order = 0;
            $exercisesPayload = $dayPayload['exercises'] ?? [];
            ksort($exercisesPayload);
            foreach ($exercisesPayload as $exercisePayload) {
                if (blank($exercisePayload['name'] ?? null) && blank($exercisePayload['catalog_exercise_id'] ?? null)) {
                    continue;
                }

                $catalog = $this->catalogResolver->resolve($user, $exercisePayload);
                $values = [
                    'routine_id' => $routine->id,
                    'routine_day_id' => $day->id,
                    'catalog_exercise_id' => $catalog->id,
                    'name' => $catalog->name,
                    'sort_order' => $order++,
                    'tracking_mode' => $exercisePayload['tracking_mode'] ?? $catalog->tracking_mode ?? 'weight_reps',
                    'time_direction' => $exercisePayload['time_direction'] ?? $catalog->time_direction ?? 'faster',
                    'default_sets' => $exercisePayload['default_sets'] ?? $catalog->default_sets ?? 3,
                    'default_reps' => $exercisePayload['default_reps'] ?? $catalog->default_reps ?? 10,
                    'default_duration_seconds' => $exercisePayload['default_duration_seconds'] ?? $catalog->default_duration_seconds,
                    'rest_seconds' => $exercisePayload['rest_seconds'] ?? $catalog->rest_seconds ?? 90,
                    'target_muscle' => $exercisePayload['target_muscle'] ?? $catalog->target_muscle,
                    'notes' => array_key_exists('notes', $exercisePayload) ? $exercisePayload['notes'] : $catalog->notes,
                ];

                $exerciseId = $exercisePayload['id'] ?? null;
                /** @var RoutineExercise|null $exercise */
                $exercise = $exerciseId !== null ? $existingExercises->get($exerciseId) : null;

                // Si cambia el ejercicio en sí (otro catálogo) y ya tiene series, el historial
                // es del ejercicio anterior: se archiva y se crea uno nuevo.
                if ($exercise !== null
                    && (int) $exercise->catalog_exercise_id !== (int) $catalog->id
                    && ExerciseLogQuery::nameKey($exercise->name) !== ExerciseLogQuery::nameKey($catalog->name)
                    && $exercise->setLogs()->exists()) {
                    $exercise = null;
                }

                if ($exercise !== null) {
                    $exercise->update($values);
                } else {
                    $exercise = RoutineExercise::query()->create($values);
                }
                $keptExerciseIds[] = $exercise->id;
            }
        }

        foreach ($existingExercises as $exercise) {
            if (! in_array($exercise->id, $keptExerciseIds, true)) {
                $this->removeExercise($exercise);
            }
        }

        foreach ($existingDays as $day) {
            if (! in_array($day->id, $keptDayIds, true)) {
                $this->removeDay($day);
            }
        }
    }

    /**
     * Archiva el ejercicio si tiene series registradas; si no, lo borra.
     */
    public function removeExercise(RoutineExercise $exercise): void
    {
        if ($exercise->setLogs()->exists()) {
            $exercise->update(['archived_at' => now()]);

            return;
        }

        $exercise->delete();
    }

    /**
     * Archiva el día si tiene historial (series o sesiones completadas); si no, lo borra
     * junto con sus sesiones vacías.
     */
    public function removeDay(RoutineDay $day): void
    {
        $hasHistory = WorkoutSession::query()
            ->where('routine_day_id', $day->id)
            ->where(fn ($query) => $query->whereNotNull('completed_at')->orWhereHas('setLogs'))
            ->exists()
            || $day->allExercises()->whereHas('setLogs')->exists();

        if ($hasHistory) {
            foreach ($day->allExercises()->whereNull('archived_at')->get() as $exercise) {
                $this->removeExercise($exercise);
            }
            $day->update(['archived_at' => now()]);

            return;
        }

        WorkoutSession::query()
            ->where('routine_day_id', $day->id)
            ->whereNull('completed_at')
            ->whereDoesntHave('setLogs')
            ->delete();

        $day->delete();
    }
}
