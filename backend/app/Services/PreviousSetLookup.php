<?php

namespace App\Services;

use App\Models\WorkoutSession;
use Illuminate\Support\Facades\DB;

class PreviousSetLookup
{
    /**
     * Última sesión anterior de cada ejercicio, con la mejor marca según cómo se mide.
     *
     * @return array<int, array{
     *   recorded_on: string,
     *   tracking_mode: string,
     *   time_direction: string,
     *   best_weight_kg: float|null,
     *   best_reps: int|null,
     *   best_duration_seconds: int|null,
     *   sets: array<int, array{set_number: int, weight_kg: float|null, reps: int|null, duration_seconds: int|null}>
     * }>
     */
    public function forSession(WorkoutSession $session): array
    {
        $session->loadMissing('day.exercises');
        $exercises = $session->day?->exercises ?? collect();
        if ($exercises->isEmpty()) {
            return [];
        }

        // Se compara por cuándo se entrenó de verdad, no por la fecha planificada:
        // una sesión del jueves hecha el martes cuenta como del martes.
        $trainedAt = 'COALESCE(workout_sessions.started_at, workout_sessions.completed_at, workout_sessions.scheduled_date)';
        $reference = ($session->started_at ?? now())->toDateTimeString();

        $catalogIds = $exercises->pluck('catalog_exercise_id')->filter()->unique()->values();
        $nameKeys = $exercises
            ->map(fn ($exercise) => mb_strtolower(trim((string) $exercise->name)))
            ->filter()
            ->unique()
            ->values();

        $rows = DB::table('exercise_set_logs')
            ->join('workout_sessions', 'workout_sessions.id', '=', 'exercise_set_logs.workout_session_id')
            ->join('routine_exercises', 'routine_exercises.id', '=', 'exercise_set_logs.routine_exercise_id')
            ->where('workout_sessions.user_id', $session->user_id)
            ->where('workout_sessions.tenant_id', $session->tenant_id)
            ->where('workout_sessions.id', '!=', $session->id)
            ->whereRaw($trainedAt.' < ?', [$reference])
            ->where(function ($query) {
                $query->whereNotNull('exercise_set_logs.weight_kg')
                    ->orWhereNotNull('exercise_set_logs.duration_seconds');
            })
            ->where(function ($query) use ($catalogIds, $nameKeys) {
                if ($catalogIds->isNotEmpty()) {
                    $query->whereIn('routine_exercises.catalog_exercise_id', $catalogIds->all());
                }
                if ($nameKeys->isNotEmpty()) {
                    $placeholders = implode(',', array_fill(0, $nameKeys->count(), '?'));
                    $sql = 'LOWER(routine_exercises.name) IN ('.$placeholders.')';
                    if ($catalogIds->isNotEmpty()) {
                        $query->orWhereRaw($sql, $nameKeys->all());
                    } else {
                        $query->whereRaw($sql, $nameKeys->all());
                    }
                }
            })
            ->orderByRaw($trainedAt.' DESC')
            ->orderByDesc('workout_sessions.id')
            ->orderBy('exercise_set_logs.set_number')
            ->get([
                'workout_sessions.id as session_id',
                DB::raw($trainedAt.' as trained_at'),
                'routine_exercises.catalog_exercise_id',
                'routine_exercises.name',
                'exercise_set_logs.set_number',
                'exercise_set_logs.weight_kg',
                'exercise_set_logs.reps',
                'exercise_set_logs.duration_seconds',
            ]);

        $result = [];

        foreach ($exercises as $exercise) {
            $catalogId = $exercise->catalog_exercise_id;
            $nameKey = mb_strtolower(trim((string) $exercise->name));
            $mode = $exercise->tracking_mode ?? 'weight_reps';
            $direction = $exercise->time_direction ?? 'faster';
            $timed = in_array($mode, ['time', 'weight_time'], true);

            // Solo filas con el dato que importa (kg o tiempo): si la última vez no se
            // apuntaron kilos, se salta a la anterior que sí los tenga.
            $matches = $rows->filter(function ($row) use ($catalogId, $nameKey, $timed) {
                if ($timed ? $row->duration_seconds === null : $row->weight_kg === null) {
                    return false;
                }
                $sameName = $nameKey !== '' && mb_strtolower(trim((string) $row->name)) === $nameKey;
                if ($catalogId) {
                    if ((int) $row->catalog_exercise_id === (int) $catalogId) {
                        return true;
                    }

                    return $row->catalog_exercise_id === null && $sameName;
                }

                return $sameName;
            })->values();

            if ($matches->isEmpty()) {
                continue;
            }

            $latestSessionId = (int) $matches->first()->session_id;
            $latest = $matches
                ->where('session_id', $latestSessionId)
                ->sortBy('set_number')
                ->values();

            $best = $latest->sortByDesc(function ($row) use ($timed, $direction) {
                if ($timed) {
                    $seconds = (int) $row->duration_seconds;
                    $score = $direction === 'longer' ? $seconds : -$seconds;

                    return $score * 1000 + (float) ($row->weight_kg ?? 0);
                }

                return ((float) $row->weight_kg) * 1000 + (int) ($row->reps ?? 0);
            })->first();

            $result[$exercise->id] = [
                'recorded_on' => substr((string) $latest->first()->trained_at, 0, 10),
                'tracking_mode' => $mode,
                'time_direction' => $direction,
                'best_weight_kg' => $best->weight_kg !== null ? (float) $best->weight_kg : null,
                'best_reps' => $best->reps !== null ? (int) $best->reps : null,
                'best_duration_seconds' => $best->duration_seconds !== null ? (int) $best->duration_seconds : null,
                'sets' => $latest->map(fn ($row) => [
                    'set_number' => (int) $row->set_number,
                    'weight_kg' => $row->weight_kg !== null ? (float) $row->weight_kg : null,
                    'reps' => $row->reps !== null ? (int) $row->reps : null,
                    'duration_seconds' => $row->duration_seconds !== null ? (int) $row->duration_seconds : null,
                ])->all(),
            ];
        }

        return $result;
    }
}
