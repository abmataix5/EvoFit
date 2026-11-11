<?php

namespace App\Services;

use App\Models\CatalogExercise;
use App\Models\RoutineExercise;
use App\Models\User;
use App\Models\WorkoutSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cambia o añade ejercicios en una sesión sin tocar la rutina.
 */
class SessionExerciseChanger
{
    public function __construct(private readonly CatalogExerciseResolver $catalog) {}

    /**
     * Añade un ejercicio al final o, con $replacesId, en lugar de uno de los de hoy.
     *
     * @param  array{catalog_exercise_id?: int|null, name?: string|null}  $choice
     */
    public function add(User $user, WorkoutSession $session, array $choice, ?int $replacesId = null): RoutineExercise
    {
        $catalog = $this->catalog->resolve($user, $choice);

        return DB::transaction(function () use ($session, $catalog, $replacesId) {
            $today = $session->exercisesForToday();
            $replaced = null;

            if ($replacesId !== null) {
                $replaced = $today->firstWhere('id', $replacesId);
                if ($replaced === null) {
                    throw ValidationException::withMessages([
                        'replaces_routine_exercise_id' => 'Ese ejercicio no está en el entreno de hoy.',
                    ]);
                }
                if ($this->hasLoggedSets($session, $replaced)) {
                    throw ValidationException::withMessages([
                        'replaces_routine_exercise_id' => 'Ya has apuntado series de este ejercicio: añade el nuevo en lugar de cambiarlo.',
                    ]);
                }
                if ($replaced->catalog_exercise_id === $catalog->id) {
                    throw ValidationException::withMessages([
                        'catalog_exercise_id' => 'Es el mismo ejercicio.',
                    ]);
                }
            }

            $values = $this->valuesFrom($catalog, $replaced);
            $values += [
                'tenant_id' => $session->tenant_id,
                'routine_id' => $session->routine_id,
                'routine_day_id' => $session->routine_day_id,
                'workout_session_id' => $session->id,
            ];

            if ($replaced?->isSessionOnly()) {
                // Cambiar un cambio: el nuevo hereda a quién sustituía (o que era un añadido).
                $values['replaces_routine_exercise_id'] = $replaced->replaces_routine_exercise_id;
                $values['sort_order'] = $replaced->sort_order;
                $replaced->delete();
            } elseif ($replaced !== null) {
                $values['replaces_routine_exercise_id'] = $replaced->id;
                $values['sort_order'] = $replaced->sort_order;
            } else {
                $values['replaces_routine_exercise_id'] = null;
                $values['sort_order'] = ((int) $today->max('sort_order')) + 1;
            }

            return RoutineExercise::query()->create($values);
        });
    }

    /**
     * Quita un cambio o añadido de hoy (con sus series): si sustituía a otro, vuelve el original.
     */
    public function remove(WorkoutSession $session, RoutineExercise $exercise): void
    {
        abort_unless($exercise->workout_session_id === $session->id, 404);

        // Las series cuelgan del ejercicio y se borran en cascada.
        $exercise->delete();
    }

    private function hasLoggedSets(WorkoutSession $session, RoutineExercise $exercise): bool
    {
        return $session->setLogs()
            ->where('routine_exercise_id', $exercise->id)
            ->where(fn ($q) => $q->whereNotNull('weight_kg')->orWhereNotNull('reps')->orWhereNotNull('duration_seconds'))
            ->exists();
    }

    /**
     * Datos del ejercicio nuevo: los del catálogo, conservando series, reps y descanso
     * planificados si sustituye a otro que se mide igual.
     *
     * @return array<string, mixed>
     */
    private function valuesFrom(CatalogExercise $catalog, ?RoutineExercise $replaced): array
    {
        $values = [
            'catalog_exercise_id' => $catalog->id,
            'name' => $catalog->name,
            'target_muscle' => $catalog->target_muscle,
            'tracking_mode' => $catalog->tracking_mode ?? 'weight_reps',
            'time_direction' => $catalog->time_direction ?? 'faster',
            'default_sets' => $catalog->default_sets ?? 3,
            'default_reps' => $catalog->default_reps ?? 10,
            'default_duration_seconds' => $catalog->default_duration_seconds,
            'rest_seconds' => $catalog->rest_seconds ?? 90,
        ];

        if ($replaced !== null && ($replaced->tracking_mode ?? 'weight_reps') === $values['tracking_mode']) {
            $values['default_sets'] = $replaced->default_sets;
            $values['default_reps'] = $replaced->default_reps;
            $values['default_duration_seconds'] = $replaced->default_duration_seconds ?? $values['default_duration_seconds'];
            $values['rest_seconds'] = $replaced->rest_seconds ?? $values['rest_seconds'];
        }

        return $values;
    }
}
