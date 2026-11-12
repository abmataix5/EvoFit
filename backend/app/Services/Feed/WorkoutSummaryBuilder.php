<?php

namespace App\Services\Feed;

use App\Models\ExerciseSetLog;
use App\Models\WorkoutSession;
use App\Services\PreviousSetLookup;
use Illuminate\Support\Collection;

/**
 * Resumen de un entreno para el feed, calculado en el servidor con las series guardadas
 * (no con lo que diga el móvil): duración, series, volumen, mejores series y récords.
 */
class WorkoutSummaryBuilder
{
    public function __construct(private readonly PreviousSetLookup $previousSets) {}

    /** @return array<string, mixed> */
    public function build(WorkoutSession $session): array
    {
        $session->loadMissing(['routine', 'day', 'setLogs.routineExercise.catalogExercise.exercise']);
        $logs = $session->setLogs
            ->filter(fn (ExerciseSetLog $log) => $this->hasData($log) && ($log->completed === null || $log->completed))
            ->sortBy('set_number');

        // Récords: comparados con lo mejor de antes de esta sesión.
        $previous = $this->previousSets->forSession($session);
        $order = $session->exercisesForToday()->pluck('id')->flip();

        $exercises = $logs
            ->groupBy('routine_exercise_id')
            ->sortBy(fn (Collection $sets, $id) => $order[$id] ?? PHP_INT_MAX)
            ->map(function (Collection $sets) use ($previous) {
                $exercise = $sets->first()->routineExercise;
                $mode = $exercise?->tracking_mode ?? 'weight_reps';
                $best = $this->bestSet($sets, $mode, $exercise?->time_direction ?? 'faster');
                $record = $previous[(string) $exercise?->id]['record_weight_kg'] ?? null;
                $bestWeight = $sets->max(fn (ExerciseSetLog $s) => $s->weight_kg !== null ? (float) $s->weight_kg : null);

                return [
                    'name' => $exercise?->name ?? 'Ejercicio',
                    'image_url' => $exercise?->catalogExercise?->exercise?->imageUrls()[0] ?? null,
                    'sets' => $sets->count(),
                    'best' => $this->label($best, $mode),
                    'record' => $mode !== 'time' && $bestWeight !== null && $record !== null && $bestWeight > (float) $record
                        ? ['weight_kg' => $bestWeight, 'previous_kg' => (float) $record]
                        : null,
                ];
            })
            ->values();

        $minutes = $session->started_at && $session->completed_at
            ? (int) round($session->started_at->diffInMinutes($session->completed_at))
            : null;

        return [
            'title' => $session->day?->name ?? $session->routine?->name ?? 'Entreno',
            'routine_name' => $session->routine?->name,
            'trained_on' => ($session->trained_on ?? $session->started_at ?? $session->scheduled_date)?->toDateString(),
            // Una sesión que se quedó abierta horas no da una duración real.
            'duration_minutes' => $minutes !== null && $minutes > 0 && $minutes <= 360 ? $minutes : null,
            'sets' => $logs->count(),
            'volume_kg' => (int) round($logs->sum(fn (ExerciseSetLog $s) => (float) ($s->weight_kg ?? 0) * (int) ($s->reps ?? 0))),
            'exercises' => $exercises->all(),
            'records' => $exercises->filter(fn ($e) => $e['record'] !== null)->pluck('name')->values()->all(),
        ];
    }

    public function hasLoggedSets(WorkoutSession $session): bool
    {
        return $session->setLogs()->get()->contains(fn (ExerciseSetLog $log) => $this->hasData($log));
    }

    private function hasData(ExerciseSetLog $log): bool
    {
        return $log->weight_kg !== null || $log->reps !== null || $log->duration_seconds !== null;
    }

    private function bestSet(Collection $sets, string $mode, string $direction): ExerciseSetLog
    {
        if ($mode === 'time') {
            $timed = $sets->filter(fn ($s) => $s->duration_seconds !== null);
            if ($timed->isNotEmpty()) {
                return $direction === 'longer' ? $timed->sortByDesc('duration_seconds')->first() : $timed->sortBy('duration_seconds')->first();
            }
        }

        return $sets->sortByDesc(fn (ExerciseSetLog $s) => [(float) ($s->weight_kg ?? 0), (int) ($s->reps ?? 0)])->first();
    }

    private function label(ExerciseSetLog $set, string $mode): string
    {
        $kg = $set->weight_kg !== null ? rtrim(rtrim(number_format((float) $set->weight_kg, 2, ',', ''), '0'), ',').' kg' : null;
        $time = $set->duration_seconds !== null ? sprintf('%d:%02d', intdiv($set->duration_seconds, 60), $set->duration_seconds % 60) : null;

        return match ($mode) {
            'time' => $time ?? '—',
            'weight_time' => implode(' · ', array_filter([$kg, $time])) ?: '—',
            default => $kg !== null && $set->reps !== null ? "{$kg} × {$set->reps}" : ($kg ?? ($set->reps !== null ? "{$set->reps} reps" : '—')),
        };
    }
}
