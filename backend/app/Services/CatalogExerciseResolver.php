<?php

namespace App\Services;

use App\Models\CatalogExercise;
use App\Models\User;

class CatalogExerciseResolver
{
    /**
     * @param  array{
     *   name?: string|null,
     *   catalog_exercise_id?: int|null,
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

        $nameKey = mb_strtolower($name);

        $existing = CatalogExercise::query()
            ->where('user_id', $user->id)
            ->where('name_key', $nameKey)
            ->first();

        if ($existing) {
            return $existing;
        }

        return CatalogExercise::query()->create([
            'user_id' => $user->id,
            'name' => $name,
            'name_key' => $nameKey,
            'target_muscle' => $payload['target_muscle'] ?? null,
            'tracking_mode' => $payload['tracking_mode'] ?? 'weight_reps',
            'time_direction' => $payload['time_direction'] ?? 'faster',
            'default_sets' => $payload['default_sets'] ?? 3,
            'default_reps' => $payload['default_reps'] ?? 10,
            'default_duration_seconds' => $payload['default_duration_seconds'] ?? null,
            'rest_seconds' => $payload['rest_seconds'] ?? 90,
            'notes' => $payload['notes'] ?? null,
        ]);
    }
}
