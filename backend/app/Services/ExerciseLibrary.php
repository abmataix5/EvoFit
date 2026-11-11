<?php

namespace App\Services;

use App\Models\CatalogExercise;
use App\Models\Exercise;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Carga la biblioteca común desde database/data/exercise_library.json y enlaza con ella
 * los ejercicios que los usuarios ya tenían en su catálogo (por nombre o sinónimo).
 */
class ExerciseLibrary
{
    public const DATA_FILE = 'data/exercise_library.json';

    /**
     * Inserta o actualiza cada ejercicio por su slug. No borra: un ejercicio retirado
     * del fichero sigue existiendo para quien ya lo use.
     *
     * @return int Ejercicios en el fichero.
     */
    public function sync(): int
    {
        $rows = $this->load();

        DB::transaction(function () use ($rows) {
            foreach ($rows as $row) {
                Exercise::query()->updateOrCreate(['slug' => $row['slug']], [
                    'name' => $row['name'],
                    'aliases' => $row['aliases'],
                    'muscle' => $row['muscle'],
                    'secondary_muscles' => $row['secondary_muscles'],
                    'equipment' => $row['equipment'],
                    'mechanic' => $row['mechanic'],
                    'tracking_mode' => $row['tracking_mode'],
                    'time_direction' => $row['time_direction'],
                    'default_sets' => $row['default_sets'],
                    'default_reps' => $row['default_reps'],
                    'default_duration_seconds' => $row['default_duration_seconds'],
                    'rest_seconds' => $row['rest_seconds'],
                    'cues' => $row['cues'],
                    'has_image' => $row['image_source'] !== null,
                ]);
            }
        });

        return count($rows);
    }

    /**
     * Enlaza los ejercicios del catálogo de los usuarios que aún no lo están y cuyo nombre
     * coincide con el nombre o un sinónimo de la biblioteca. Idempotente.
     *
     * @return int Ejercicios enlazados.
     */
    public function linkCatalog(): int
    {
        $index = $this->matchIndex();
        $linked = 0;

        CatalogExercise::query()
            ->withoutGlobalScopes()
            ->whereNull('exercise_id')
            ->orderBy('id')
            ->each(function (CatalogExercise $entry) use ($index, &$linked) {
                $exerciseId = $index[trim(Exercise::matchKey($entry->name))] ?? null;
                if ($exerciseId === null) {
                    return;
                }

                $taken = CatalogExercise::query()
                    ->withoutGlobalScopes()
                    ->where('user_id', $entry->user_id)
                    ->where('exercise_id', $exerciseId)
                    ->exists();
                if ($taken) {
                    return;
                }

                $entry->forceFill(['exercise_id' => $exerciseId])->saveQuietly();
                $linked++;
            });

        return $linked;
    }

    /**
     * Busca en la biblioteca por nombre exacto o sinónimo.
     */
    public function match(string $name): ?Exercise
    {
        $id = $this->matchIndex()[trim(Exercise::matchKey($name))] ?? null;

        return $id ? Exercise::query()->find($id) : null;
    }

    /** @return array<string, int> clave normalizada => id del ejercicio */
    private function matchIndex(): array
    {
        $index = [];
        foreach (Exercise::query()->get() as $exercise) {
            foreach ($exercise->matchKeys() as $key) {
                $index[$key] ??= $exercise->id;
            }
        }

        return $index;
    }

    /** @return Collection<int, array<string, mixed>> */
    private function load(): Collection
    {
        $path = database_path(self::DATA_FILE);
        $rows = json_decode((string) @file_get_contents($path), true);
        if (! is_array($rows)) {
            throw new RuntimeException("No se puede leer la biblioteca de ejercicios ({$path}).");
        }

        return collect($rows);
    }
}
