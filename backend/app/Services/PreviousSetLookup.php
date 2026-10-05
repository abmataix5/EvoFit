<?php

namespace App\Services;

use App\Models\WorkoutSession;
use Illuminate\Support\Facades\DB;

class PreviousSetLookup
{
    /**
     * Última sesión anterior de cada ejercicio del día, con el mejor peso y el detalle por serie.
     *
     * @return array<int, array{recorded_on: string, best_weight_kg: float, best_reps: int|null, sets: array<int, array{set_number: int, weight_kg: float, reps: int|null}>}>
     */
    public function forSession(WorkoutSession $session): array
    {
        $session->loadMissing('day.exercises');
        $exercises = $session->day?->exercises ?? collect();
        if ($exercises->isEmpty() || $session->scheduled_date === null) {
            return [];
        }

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
            ->whereDate('workout_sessions.scheduled_date', '<', $session->scheduled_date->toDateString())
            ->whereNotNull('exercise_set_logs.weight_kg')
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
            ->orderByDesc('workout_sessions.scheduled_date')
            ->orderByDesc('workout_sessions.id')
            ->orderBy('exercise_set_logs.set_number')
            ->get([
                'workout_sessions.id as session_id',
                'workout_sessions.scheduled_date',
                'routine_exercises.catalog_exercise_id',
                'routine_exercises.name',
                'exercise_set_logs.set_number',
                'exercise_set_logs.weight_kg',
                'exercise_set_logs.reps',
            ]);

        $result = [];

        foreach ($exercises as $exercise) {
            $catalogId = $exercise->catalog_exercise_id;
            $nameKey = mb_strtolower(trim((string) $exercise->name));

            $matches = $rows->filter(function ($row) use ($catalogId, $nameKey) {
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
            $latest = $matches->where('session_id', $latestSessionId)->sortBy('set_number')->values();
            $best = $latest->sortByDesc(fn ($row) => ((float) $row->weight_kg) * 1000 + (int) ($row->reps ?? 0))->first();

            $result[$exercise->id] = [
                'recorded_on' => substr((string) $latest->first()->scheduled_date, 0, 10),
                'best_weight_kg' => (float) $best->weight_kg,
                'best_reps' => $best->reps !== null ? (int) $best->reps : null,
                'sets' => $latest->map(fn ($row) => [
                    'set_number' => (int) $row->set_number,
                    'weight_kg' => (float) $row->weight_kg,
                    'reps' => $row->reps !== null ? (int) $row->reps : null,
                ])->all(),
            ];
        }

        return $result;
    }
}
