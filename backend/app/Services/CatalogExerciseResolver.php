<?php

namespace App\Services;

use App\Models\CatalogExercise;
use App\Models\Exercise;
use App\Models\User;

/**
 * Encuentra o crea el ejercicio de "Mis ejercicios" que corresponde a lo que elige el
 * usuario: uno suyo, uno de la biblioteca común o un nombre escrito a mano.
 */
class CatalogExerciseResolver
{
    public function __construct(private readonly ExerciseLibrary $library) {}

    /**
     * @param  array{
     *   name?: string|null,
     *   catalog_exercise_id?: int|null,
     *   exercise_id?: int|null,
     *   target_muscle?: string|null,
     *   tracking_mode?: string|null,
     *   time_direction?: string|null,
     *   default_sets?: int|null,
     *   default_reps?: int|null,
     *   default_duration_seconds?: int|null,
     *   rest_seconds?: int|null,
     *   notes?: string|null
     * }  $payload
     */
    public function resolve(User $user, array $payload): CatalogExercise
    {
        if (! empty($payload['exercise_id'])) {
            return $this->fromLibrary($user, Exercise::query()->findOrFail($payload['exercise_id']));
        }

        if (! empty($payload['catalog_exercise_id'])) {
            $catalog = CatalogExercise::query()
                ->where('user_id', $user->id)
                ->whereKey($payload['catalog_exercise_id'])
                ->firstOrFail();

            if (! blank($payload['name'] ?? null)) {
                $name = trim((string) $payload['name']);
                if (mb_strtolower($name) !== $catalog->name_key) {
                    // Si el usuario cambia el nombre al crear la rutina, usamos findOrCreate.
                    return $this->findOrCreate($user, array_merge($payload, ['name' => $name]));
                }
            }

            return $catalog;
        }

        return $this->findOrCreate($user, $payload);
    }

    /**
     * El ejercicio de la biblioteca en "Mis ejercicios": el que ya estaba enlazado, uno con
     * el mismo nombre (que se enlaza) o uno nuevo con los valores recomendados.
     */
    public function fromLibrary(User $user, Exercise $exercise): CatalogExercise
    {
        $linked = CatalogExercise::query()->where('user_id', $user->id)->where('exercise_id', $exercise->id)->first();
        if ($linked) {
            return $linked;
        }

        $sameName = CatalogExercise::query()
            ->where('user_id', $user->id)
            ->whereNull('exercise_id')
            ->where('name_key', mb_strtolower($exercise->name))
            ->first();
        if ($sameName) {
            $sameName->update(['exercise_id' => $exercise->id]);

            return $sameName;
        }

        return CatalogExercise::query()->create([
            'user_id' => $user->id,
            'exercise_id' => $exercise->id,
            ...$this->libraryValues($exercise),
        ]);
    }

    /**
     * @param  array{
     *   name?: string|null,
     *   target_muscle?: string|null,
     *   tracking_mode?: string|null,
     *   time_direction?: string|null,
     *   default_sets?: int|null,
     *   default_reps?: int|null,
     *   default_duration_seconds?: int|null,
     *   rest_seconds?: int|null,
     *   notes?: string|null
     * }  $payload
     */
    public function findOrCreate(User $user, array $payload): CatalogExercise
    {
        $name = trim((string) ($payload['name'] ?? ''));
        abort_if($name === '', 422, 'El nombre del ejercicio es obligatorio.');

        $existing = CatalogExercise::query()
            ->where('user_id', $user->id)
            ->where('name_key', mb_strtolower($name))
            ->first();

        if ($existing) {
            return $existing;
        }

        // Escrito a mano pero existe en la biblioteca (por nombre o sinónimo): se enlaza.
        $library = $this->library->match($name);
        if ($library) {
            $linked = CatalogExercise::query()->where('user_id', $user->id)->where('exercise_id', $library->id)->first();
            if ($linked) {
                return $linked;
            }
        }

        $defaults = $library ? $this->libraryValues($library) : [];

        return CatalogExercise::query()->create([
            'user_id' => $user->id,
            'exercise_id' => $library?->id,
            'name' => $name,
            'target_muscle' => $payload['target_muscle'] ?? $defaults['target_muscle'] ?? null,
            'tracking_mode' => $payload['tracking_mode'] ?? $defaults['tracking_mode'] ?? 'weight_reps',
            'time_direction' => $payload['time_direction'] ?? $defaults['time_direction'] ?? 'faster',
            'default_sets' => $payload['default_sets'] ?? $defaults['default_sets'] ?? 3,
            'default_reps' => $payload['default_reps'] ?? $defaults['default_reps'] ?? 10,
            'default_duration_seconds' => $payload['default_duration_seconds'] ?? $defaults['default_duration_seconds'] ?? null,
            'rest_seconds' => $payload['rest_seconds'] ?? $defaults['rest_seconds'] ?? 90,
            'notes' => $payload['notes'] ?? null,
        ]);
    }

    /** @return array<string, mixed> */
    private function libraryValues(Exercise $exercise): array
    {
        return [
            'name' => $exercise->name,
            'target_muscle' => $exercise->muscleLabel(),
            'tracking_mode' => $exercise->tracking_mode,
            'time_direction' => $exercise->time_direction,
            'default_sets' => $exercise->default_sets,
            'default_reps' => $exercise->default_reps,
            'default_duration_seconds' => $exercise->default_duration_seconds,
            'rest_seconds' => $exercise->rest_seconds,
        ];
    }
}
