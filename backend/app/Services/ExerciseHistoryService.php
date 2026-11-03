<?php

namespace App\Services;

use App\Models\RoutineExercise;
use App\Models\User;
use App\Models\WorkoutSession;

class ExerciseHistoryService
{
    public const MAX_SESSIONS = 100;

    public function __construct(private readonly ExerciseLogQuery $logs) {}

    /**
     * Evolución de un ejercicio sesión a sesión (orden ascendente por fecha real).
     *
     * @return array{name: string, tracking_mode: string, time_direction: string, entries: array<int, array<string, mixed>>}
     */
    public function forExercise(User $user, RoutineExercise $exercise): array
    {
        $mode = $exercise->tracking_mode ?? 'weight_reps';
        $direction = $exercise->time_direction ?? 'faster';
        $timed = ExerciseLogQuery::isTimed($mode);
        $trainedAt = WorkoutSession::trainedAtSql();

        $rows = $this->logs
            ->rowsFor((int) $user->id, (int) $user->tenant_id, [$exercise])
            ->where(function ($query) {
                $query->whereNotNull('exercise_set_logs.weight_kg')
                    ->orWhereNotNull('exercise_set_logs.reps')
                    ->orWhereNotNull('exercise_set_logs.duration_seconds');
            })
            ->orderByRaw($trainedAt.' DESC')
            ->orderByDesc('workout_sessions.id')
            ->orderBy('exercise_set_logs.set_number')
            ->get()
            ->filter(fn ($row) => ExerciseLogQuery::matches($row, $exercise));

        // Solo sesiones con el dato que importa (kg o tiempo), igual que "la última vez".
        $entries = $rows
            ->filter(fn ($row) => $timed ? $row->duration_seconds !== null : $row->weight_kg !== null)
            ->groupBy('session_id')
            ->take(self::MAX_SESSIONS)
            ->map(function ($sessionRows, $sessionId) use ($mode, $direction, $timed) {
                $sets = $sessionRows->sortBy('set_number')->values();
                $weighted = $sets->filter(fn ($row) => $row->weight_kg !== null);

                $bestWeight = $weighted->isNotEmpty() ? (float) $weighted->max(fn ($row) => (float) $row->weight_kg) : null;
                $bestReps = null;
                if ($bestWeight !== null) {
                    $reps = $weighted
                        ->filter(fn ($row) => abs((float) $row->weight_kg - $bestWeight) < 0.001 && $row->reps !== null)
                        ->map(fn ($row) => (int) $row->reps);
                    $bestReps = $reps->isNotEmpty() ? (int) $reps->max() : null;
                } else {
                    $reps = $sets->filter(fn ($row) => $row->reps !== null)->map(fn ($row) => (int) $row->reps);
                    $bestReps = $reps->isNotEmpty() ? (int) $reps->max() : null;
                }

                $durations = $sets->filter(fn ($row) => $row->duration_seconds !== null)->map(fn ($row) => (int) $row->duration_seconds);
                $bestDuration = null;
                if ($timed && $durations->isNotEmpty()) {
                    $bestDuration = $direction === 'longer' ? (int) $durations->max() : (int) $durations->min();
                }

                $oneRm = null;
                if ($mode === 'weight_reps') {
                    $estimates = $weighted
                        ->map(fn ($row) => ExerciseLogQuery::epley((float) $row->weight_kg, $row->reps !== null ? (int) $row->reps : null))
                        ->filter(fn ($value) => $value !== null);
                    $oneRm = $estimates->isNotEmpty() ? round((float) $estimates->max(), 1) : null;
                }

                $volume = $weighted->sum(fn ($row) => (float) $row->weight_kg * (int) ($row->reps ?? 0));

                return [
                    'date' => substr((string) $sets->first()->trained_at, 0, 10),
                    'session_id' => (int) $sessionId,
                    'best_weight_kg' => $bestWeight,
                    'best_reps' => $bestReps,
                    'best_duration_seconds' => $bestDuration,
                    'est_1rm' => $oneRm,
                    'volume_kg' => round((float) $volume, 1),
                    'sets' => $sets->map(fn ($row) => ExerciseLogQuery::setPayload($row))->all(),
                ];
            })
            ->reverse()
            ->values()
            ->all();

        return [
            'name' => $exercise->name,
            'tracking_mode' => $mode,
            'time_direction' => $direction,
            'entries' => $entries,
        ];
    }
}
