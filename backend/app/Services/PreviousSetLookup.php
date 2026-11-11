<?php

namespace App\Services;

use App\Models\WorkoutSession;
use Illuminate\Support\Collection;

class PreviousSetLookup
{
    public function __construct(private readonly ExerciseLogQuery $logs) {}

    /**
     * Última sesión anterior de cada ejercicio, con la mejor marca según cómo se mide,
     * más los récords de todas las sesiones anteriores.
     *
     * @return array<int, array{
     *   recorded_on: string,
     *   tracking_mode: string,
     *   time_direction: string,
     *   best_weight_kg: float|null,
     *   best_reps: int|null,
     *   best_duration_seconds: int|null,
     *   sets: array<int, array{set_number: int, weight_kg: float|null, reps: int|null, duration_seconds: int|null}>,
     *   record_weight_kg: float|null,
     *   record_reps: int|null,
     *   record_est_1rm: float|null,
     *   record_duration_seconds: int|null
     * }>
     */
    public function forSession(WorkoutSession $session): array
    {
        $exercises = $session->exercisesForToday();
        if ($exercises->isEmpty()) {
            return [];
        }

        // Se compara por cuándo se entrenó de verdad, no por la fecha planificada:
        // una sesión del jueves hecha el martes cuenta como del martes.
        $trainedAt = WorkoutSession::trainedAtSql();
        $reference = ($session->started_at ?? now())->toDateTimeString();

        $rows = $this->logs
            ->rowsFor((int) $session->user_id, (int) $session->tenant_id, $exercises)
            ->where('workout_sessions.id', '!=', $session->id)
            ->whereRaw($trainedAt.' < ?', [$reference])
            ->where(function ($query) {
                $query->whereNotNull('exercise_set_logs.weight_kg')
                    ->orWhereNotNull('exercise_set_logs.duration_seconds');
            })
            ->orderByRaw($trainedAt.' DESC')
            ->orderByDesc('workout_sessions.id')
            ->orderBy('exercise_set_logs.set_number')
            ->get();

        $result = [];

        foreach ($exercises as $exercise) {
            $mode = $exercise->tracking_mode ?? 'weight_reps';
            $direction = $exercise->time_direction ?? 'faster';
            $timed = ExerciseLogQuery::isTimed($mode);

            $all = $rows->filter(fn ($row) => ExerciseLogQuery::matches($row, $exercise))->values();

            // Solo filas con el dato que importa (kg o tiempo): si la última vez no se
            // apuntaron kilos, se salta a la anterior que sí los tenga.
            $matches = $all
                ->filter(fn ($row) => $timed ? $row->duration_seconds !== null : $row->weight_kg !== null)
                ->values();

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
                ...self::records($all, $mode, $direction),
            ];
        }

        return $result;
    }

    /**
     * Récords históricos. Las series marcadas como no completadas no cuentan.
     *
     * @param  Collection<int, object>  $rows
     * @return array{record_weight_kg: float|null, record_reps: int|null, record_est_1rm: float|null, record_duration_seconds: int|null}
     */
    public static function records(Collection $rows, string $mode, string $direction): array
    {
        $rows = $rows->filter(fn ($row) => $row->completed === null || (bool) $row->completed);

        $weighted = $rows->filter(fn ($row) => $row->weight_kg !== null);
        $recordWeight = $weighted->isNotEmpty() ? (float) $weighted->max(fn ($row) => (float) $row->weight_kg) : null;

        $recordReps = null;
        if ($recordWeight !== null) {
            $reps = $weighted
                ->filter(fn ($row) => abs((float) $row->weight_kg - $recordWeight) < 0.001 && $row->reps !== null)
                ->map(fn ($row) => (int) $row->reps);
            $recordReps = $reps->isNotEmpty() ? (int) $reps->max() : null;
        }

        $recordOneRm = null;
        if ($mode === 'weight_reps') {
            $estimates = $weighted
                ->map(fn ($row) => ExerciseLogQuery::epley((float) $row->weight_kg, $row->reps !== null ? (int) $row->reps : null))
                ->filter(fn ($value) => $value !== null);
            $recordOneRm = $estimates->isNotEmpty() ? round((float) $estimates->max(), 1) : null;
        }

        $recordDuration = null;
        if (ExerciseLogQuery::isTimed($mode)) {
            $durations = $rows
                ->filter(fn ($row) => $row->duration_seconds !== null)
                ->map(fn ($row) => (int) $row->duration_seconds);
            if ($durations->isNotEmpty()) {
                $recordDuration = $direction === 'longer' ? (int) $durations->max() : (int) $durations->min();
            }
        }

        return [
            'record_weight_kg' => $recordWeight,
            'record_reps' => $recordReps,
            'record_est_1rm' => $recordOneRm,
            'record_duration_seconds' => $recordDuration,
        ];
    }
}
