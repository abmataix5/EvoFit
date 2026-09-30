<?php

namespace App\Services;

use App\Models\BodyWeightEntry;
use App\Models\ExerciseSetLog;
use App\Models\User;
use App\Models\WorkoutSession;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ProgressInsightService
{
    /**
     * Informe semanal tipo entrenador: fuerza, adherencia, volumen y tip de coach.
     *
     * @return array{summary: array, training: array, coach: array, exercises: array, chart: array}
     */
    public function weeklyComparison(User $user): array
    {
        $currentStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $currentEnd = $currentStart->copy()->endOfWeek(Carbon::SUNDAY);
        $prevStart = $currentStart->copy()->subWeek();
        $prevEnd = $currentEnd->copy()->subWeek();

        $current = $this->aggregateWeek($user->id, $currentStart, $currentEnd);
        $previous = $this->aggregateWeek($user->id, $prevStart, $prevEnd);

        $names = $current->keys()->merge($previous->keys())->unique()->sort()->values();

        $exercises = [];
        $improved = 0;
        $maintained = 0;
        $declined = 0;
        $newOnes = 0;
        $volumeCurrent = 0.0;
        $volumePrevious = 0.0;

        foreach ($names as $name) {
            $curr = $current->get($name);
            $prev = $previous->get($name);

            $deltaKg = null;
            $deltaPct = null;

            if ($curr === null && $prev !== null) {
                $status = 'declined';
                $declined++;
            } elseif ($curr !== null && $prev === null) {
                $status = 'new';
                $newOnes++;
            } else {
                $deltaKg = round(((float) $curr['best_weight']) - ((float) $prev['best_weight']), 2);
                $base = max((float) $prev['best_weight'], 0.01);
                $deltaPct = round(($deltaKg / $base) * 100, 1);

                if ($deltaKg >= 0.5 || $deltaPct >= 1.5) {
                    $status = 'improved';
                    $improved++;
                } elseif ($deltaKg <= -0.5 || $deltaPct <= -1.5) {
                    $status = 'declined';
                    $declined++;
                } else {
                    $status = 'maintained';
                    $maintained++;
                }
            }

            if ($curr !== null) {
                $volumeCurrent += (float) $curr['volume'];
            }
            if ($prev !== null) {
                $volumePrevious += (float) $prev['volume'];
            }

            $exercises[] = [
                'name' => $curr['name'] ?? $prev['name'] ?? $name,
                'status' => $status,
                'current_best_kg' => $curr['best_weight'] ?? null,
                'previous_best_kg' => $prev['best_weight'] ?? null,
                'current_volume' => $curr['volume'] ?? null,
                'previous_volume' => $prev['volume'] ?? null,
                'delta_kg' => $deltaKg,
                'delta_pct' => $deltaPct,
                'coach_note' => $this->exerciseNote($status, $deltaKg, $deltaPct),
            ];
        }

        usort($exercises, function (array $a, array $b) {
            $order = ['improved' => 0, 'new' => 1, 'maintained' => 2, 'declined' => 3];

            return ($order[$a['status']] ?? 9) <=> ($order[$b['status']] ?? 9)
                ?: strcmp($a['name'], $b['name']);
        });

        $compared = $improved + $maintained + $declined;
        if ($compared === 0 && $newOnes > 0) {
            $mood = 'green';
            $label = 'Primera semana con datos reales. Buen arranque: ahora toca constancia.';
            $tip = 'Repite los mismos ejercicios clave la semana que viene para poder comparar kilos.';
            $focus = 'Construir base de datos';
        } elseif ($compared === 0) {
            $mood = 'orange';
            $label = 'Aún no hay series con peso esta semana para evaluar fuerza.';
            $tip = 'Abre una sesión, registra kilos y reps. Sin logs no hay coaching útil.';
            $focus = 'Registrar entrenamientos';
        } elseif ($declined > $improved && $declined >= max(1, (int) ceil($compared * 0.4))) {
            $mood = 'red';
            $label = 'Bajada clara en varios movimientos. Prioriza recuperación antes de forzar PR.';
            $tip = 'Revisa sueño, estrés y comida. Baja 5–10% la carga 1 sesión y vuelve a subir limpio.';
            $focus = 'Recuperación y técnica';
        } elseif ($improved >= $maintained && $improved >= $declined) {
            $mood = 'green';
            $label = 'Progreso sólido: estás empujando la barra en la mayoría de ejercicios clave.';
            $tip = 'Mantén el mismo plan 1–2 semanas más. Sube solo cuando completes todas las series con margen.';
            $focus = 'Progresión controlada';
        } else {
            $mood = 'orange';
            $label = 'Semana de mantenimiento. Normal en deload, estrés o volumen alto.';
            $tip = 'No cambies el programa aún. Busca 1–2 reps más en compuestos antes de añadir kilos.';
            $focus = 'Calidad de repeticiones';
        }

        $sessionsPlanned = WorkoutSession::query()
            ->where('user_id', $user->id)
            ->whereBetween('scheduled_date', [$currentStart->toDateString(), $currentEnd->toDateString()])
            ->whereHas('routine', fn ($q) => $q->where('is_active', true))
            ->count();

        $sessionsCompleted = WorkoutSession::query()
            ->where('user_id', $user->id)
            ->whereBetween('scheduled_date', [$currentStart->toDateString(), $currentEnd->toDateString()])
            ->whereNotNull('completed_at')
            ->count();

        $adherence = $sessionsPlanned > 0
            ? (int) round(($sessionsCompleted / $sessionsPlanned) * 100)
            : ($sessionsCompleted > 0 ? 100 : 0);

        $volumeDeltaPct = $volumePrevious > 0
            ? round((($volumeCurrent - $volumePrevious) / $volumePrevious) * 100, 1)
            : null;

        $wins = collect($exercises)
            ->where('status', 'improved')
            ->sortByDesc(fn ($row) => abs((float) ($row['delta_kg'] ?? 0)))
            ->take(3)
            ->values()
            ->all();

        $watch = collect($exercises)
            ->where('status', 'declined')
            ->sortBy(fn ($row) => (float) ($row['delta_kg'] ?? 0))
            ->take(3)
            ->values()
            ->all();

        $body = $this->bodyWeightSnapshot($user->id);

        return [
            'summary' => [
                'mood' => $mood,
                'label' => $label,
                'improved' => $improved,
                'maintained' => $maintained,
                'declined' => $declined,
                'new' => $newOnes,
                'current_week' => [
                    'from' => $currentStart->toDateString(),
                    'to' => $currentEnd->toDateString(),
                ],
                'previous_week' => [
                    'from' => $prevStart->toDateString(),
                    'to' => $prevEnd->toDateString(),
                ],
            ],
            'training' => [
                'sessions_completed' => $sessionsCompleted,
                'sessions_planned' => $sessionsPlanned,
                'adherence_pct' => $adherence,
                'volume_this_week' => round($volumeCurrent, 0),
                'volume_prev_week' => round($volumePrevious, 0),
                'volume_delta_pct' => $volumeDeltaPct,
            ],
            'coach' => [
                'tip' => $tip,
                'focus' => $focus,
                'wins' => $wins,
                'watch' => $watch,
            ],
            'body' => $body,
            'exercises' => $exercises,
            'chart' => $this->buildChartSeries($exercises),
        ];
    }

    private function exerciseNote(string $status, ?float $deltaKg, ?float $deltaPct): string
    {
        return match ($status) {
            'improved' => $deltaKg !== null
                ? 'Buen estímulo. Si las reps fueron limpias, mantén o suma +1–2,5 kg la próxima.'
                : 'Subida registrada. Sigue con la misma técnica.',
            'maintained' => 'Estancamiento sano. Añade 1–2 reps antes de tocar el peso.',
            'declined' => $deltaPct !== null && $deltaPct <= -5
                ? 'Caída notable. Baja carga, prioriza rango completo y recupera 48–72 h.'
                : 'Ligera bajada. Puede ser fatiga. No fuerces un PR esta sesión.',
            'new' => 'Primer registro. Úsalo como baseline para la próxima semana.',
            default => 'Sigue registrando series completas.',
        };
    }

    /**
     * @return array{latest_kg: float|null, previous_kg: float|null, delta_kg: float|null, trend: string, recorded_on: string|null}
     */
    private function bodyWeightSnapshot(int $userId): array
    {
        $entries = BodyWeightEntry::query()
            ->where('user_id', $userId)
            ->orderByDesc('recorded_on')
            ->limit(2)
            ->get();

        $latest = $entries->get(0);
        $previous = $entries->get(1);

        if ($latest === null) {
            return [
                'latest_kg' => null,
                'previous_kg' => null,
                'delta_kg' => null,
                'trend' => 'none',
                'recorded_on' => null,
            ];
        }

        $latestKg = (float) $latest->weight_kg;
        $previousKg = $previous ? (float) $previous->weight_kg : null;
        $delta = $previousKg !== null ? round($latestKg - $previousKg, 2) : null;

        $trend = 'stable';
        if ($delta !== null) {
            if ($delta <= -0.3) {
                $trend = 'down';
            } elseif ($delta >= 0.3) {
                $trend = 'up';
            }
        }

        return [
            'latest_kg' => $latestKg,
            'previous_kg' => $previousKg,
            'delta_kg' => $delta,
            'trend' => $trend,
            'recorded_on' => $latest->recorded_on?->toDateString(),
        ];
    }

    /**
     * @return Collection<string, array{best_weight: float, volume: float, name: string}>
     */
    private function aggregateWeek(int $userId, Carbon $from, Carbon $to): Collection
    {
        $logs = ExerciseSetLog::query()
            ->whereHas('workoutSession', function ($query) use ($userId, $from, $to) {
                $query->where('user_id', $userId)
                    ->whereBetween('scheduled_date', [$from->toDateString(), $to->toDateString()]);
            })
            ->with('routineExercise')
            ->where('completed', true)
            ->whereNotNull('weight_kg')
            ->get();

        return $logs
            ->groupBy(fn (ExerciseSetLog $log) => mb_strtolower(trim($log->routineExercise?->name ?? 'ejercicio')))
            ->map(function (Collection $group) {
                $best = (float) $group->max('weight_kg');
                $volume = (float) $group->sum(function (ExerciseSetLog $log) {
                    return ((float) $log->weight_kg) * ((int) ($log->reps ?? 0));
                });

                return [
                    'best_weight' => $best,
                    'volume' => round($volume, 1),
                    'name' => $group->first()?->routineExercise?->name ?? 'Ejercicio',
                ];
            })
            ->keyBy(fn (array $row) => mb_strtolower($row['name']));
    }

    private function buildChartSeries(array $exercises): array
    {
        return collect($exercises)
            ->filter(fn (array $row) => $row['current_best_kg'] !== null || $row['previous_best_kg'] !== null)
            ->sortByDesc(fn (array $row) => max((float) ($row['current_best_kg'] ?? 0), (float) ($row['previous_best_kg'] ?? 0)))
            ->take(6)
            ->map(fn (array $row) => [
                'name' => mb_strlen($row['name']) > 14 ? mb_substr($row['name'], 0, 12).'…' : $row['name'],
                'semana_anterior' => $row['previous_best_kg'] ?? 0,
                'esta_semana' => $row['current_best_kg'] ?? 0,
            ])
            ->values()
            ->all();
    }
}
