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
     *   default_sets?: int|null,
     *   default_reps?: int|null,
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
     *   default_sets?: int|null,
     *   default_reps?: int|null,
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
            'default_sets' => $payload['default_sets'] ?? 3,
            'default_reps' => $payload['default_reps'] ?? 10,
            'rest_seconds' => $payload['rest_seconds'] ?? 90,
            'notes' => $payload['notes'] ?? null,
        ]);
    }
}
