<?php

namespace App\Services;

use App\Models\RoutineExercise;
use App\Models\WorkoutSession;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Consulta compartida de series registradas de "el mismo ejercicio".
 *
 * Dos ejercicios de rutina son el mismo si comparten catalog_exercise_id o, si el
 * registrado no tiene catálogo, si su nombre coincide sin mayúsculas. Los
 * ejercicios archivados siguen contando (conservan su historial).
 */
class ExerciseLogQuery
{
    /**
     * Filas (una por serie) de las sesiones del usuario que pueden coincidir con
     * alguno de los ejercicios dados. Hay que refinar en PHP con matches().
     *
     * Columnas: session_id, trained_at, catalog_exercise_id, name, set_number,
     * weight_kg, reps, duration_seconds, rpe, completed.
     *
     * @param  iterable<RoutineExercise>  $exercises
     */
    public function rowsFor(int $userId, int $tenantId, iterable $exercises): Builder
    {
        $exercises = collect($exercises);
        $catalogIds = $exercises->pluck('catalog_exercise_id')->filter()->unique()->values();
        $nameKeys = $exercises
            ->map(fn ($exercise) => self::nameKey($exercise->name))
            ->filter()
            ->unique()
            ->values();

        $trainedAt = WorkoutSession::trainedAtSql();

        return DB::table('exercise_set_logs')
            ->join('workout_sessions', 'workout_sessions.id', '=', 'exercise_set_logs.workout_session_id')
            ->join('routine_exercises', 'routine_exercises.id', '=', 'exercise_set_logs.routine_exercise_id')
            ->where('workout_sessions.user_id', $userId)
            ->where('workout_sessions.tenant_id', $tenantId)
            ->where(function ($query) use ($catalogIds, $nameKeys) {
                if ($catalogIds->isEmpty() && $nameKeys->isEmpty()) {
                    $query->whereRaw('1 = 0');

                    return;
                }
                if ($catalogIds->isNotEmpty()) {
                    $query->whereIn('routine_exercises.catalog_exercise_id', $catalogIds->all());
                }
                if ($nameKeys->isNotEmpty()) {
                    $placeholders = implode(',', array_fill(0, $nameKeys->count(), '?'));
                    $query->orWhereRaw('LOWER(TRIM(routine_exercises.name)) IN ('.$placeholders.')', $nameKeys->all());
                }
            })
            ->select([
                'workout_sessions.id as session_id',
                DB::raw($trainedAt.' as trained_at'),
                'routine_exercises.catalog_exercise_id',
                'routine_exercises.name',
                'exercise_set_logs.set_number',
                'exercise_set_logs.weight_kg',
                'exercise_set_logs.reps',
                'exercise_set_logs.duration_seconds',
                'exercise_set_logs.rpe',
                'exercise_set_logs.completed',
            ]);
    }

    /**
     * ¿La fila registrada corresponde a este ejercicio?
     */
    public static function matches(object $row, RoutineExercise $exercise): bool
    {
        $nameKey = self::nameKey($exercise->name);
        $sameName = $nameKey !== '' && self::nameKey($row->name) === $nameKey;

        if ($exercise->catalog_exercise_id) {
            if ((int) $row->catalog_exercise_id === (int) $exercise->catalog_exercise_id) {
                return true;
            }

            return $row->catalog_exercise_id === null && $sameName;
        }

        return $sameName;
    }

    public static function nameKey(?string $name): string
    {
        return mb_strtolower(trim((string) $name));
    }

    public static function isTimed(?string $mode): bool
    {
        return in_array($mode, ['time', 'weight_time'], true);
    }

    /**
     * 1RM estimado (Epley): w * (1 + reps / 30).
     */
    public static function epley(?float $weight, ?int $reps): ?float
    {
        if ($weight === null || $reps === null || $reps < 1 || $weight <= 0) {
            return null;
        }

        return $weight * (1 + $reps / 30);
    }

    /**
     * Normaliza una fila de consulta a tipos PHP.
     *
     * @return array{set_number: int, weight_kg: float|null, reps: int|null, duration_seconds: int|null, rpe: float|null}
     */
    public static function setPayload(object $row): array
    {
        return [
            'set_number' => (int) $row->set_number,
            'weight_kg' => $row->weight_kg !== null ? (float) $row->weight_kg : null,
            'reps' => $row->reps !== null ? (int) $row->reps : null,
            'duration_seconds' => $row->duration_seconds !== null ? (int) $row->duration_seconds : null,
            'rpe' => $row->rpe !== null ? (float) $row->rpe : null,
        ];
    }
}
