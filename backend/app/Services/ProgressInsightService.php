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

            $metric = data_get($curr, 'metric') ?? data_get($prev, 'metric') ?? 'weight';
            $direction = data_get($curr, 'time_direction') ?? data_get($prev, 'time_direction');
            $deltaSeconds = null;
            $metricsDiffer = $curr !== null && $prev !== null && ($curr['metric'] ?? 'weight') !== ($prev['metric'] ?? 'weight');

            if ($curr === null && $prev !== null) {
                $status = 'declined';
                $declined++;
            } elseif ($curr !== null && $prev === null) {
                $status = 'new';
                $newOnes++;
            } elseif ($metricsDiffer) {
                $status = 'new';
                $newOnes++;
            } elseif ($metric === 'time') {
                $deltaSeconds = (int) $curr['best_seconds'] - (int) $prev['best_seconds'];
                $base = max((int) $prev['best_seconds'], 1);
                $deltaPct = round(($deltaSeconds / $base) * 100, 1);
                $longer = ($direction ?? 'faster') === 'longer';
                $better = $longer ? $deltaSeconds > 0 : $deltaSeconds < 0;
                $worse = $longer ? $deltaSeconds < 0 : $deltaSeconds > 0;
                $meaningful = abs($deltaSeconds) >= 2 || abs((float) $deltaPct) >= 1.5;

                if ($better && $meaningful) {
                    $status = 'improved';
                    $improved++;
                } elseif ($worse && $meaningful) {
                    $status = 'declined';
                    $declined++;
                } else {
                    $status = 'maintained';
                    $maintained++;
                }
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

            if (data_get($curr, 'metric') === 'weight') {
                $volumeCurrent += (float) $curr['volume'];
            }
            if (data_get($prev, 'metric') === 'weight') {
                $volumePrevious += (float) $prev['volume'];
            }

            $exercises[] = [
                'catalog_exercise_id' => data_get($curr, 'catalog_exercise_id') ?? data_get($prev, 'catalog_exercise_id'),
                'name' => data_get($curr, 'name') ?? data_get($prev, 'name') ?? $name,
                'metric' => $metric,
                'time_direction' => $direction,
                'status' => $status,
                'current_best_kg' => data_get($curr, 'metric') === 'weight' ? $curr['best_weight'] : null,
                'previous_best_kg' => data_get($prev, 'metric') === 'weight' ? $prev['best_weight'] : null,
                'current_best_seconds' => data_get($curr, 'metric') === 'time' ? $curr['best_seconds'] : null,
                'previous_best_seconds' => data_get($prev, 'metric') === 'time' ? $prev['best_seconds'] : null,
                'current_volume' => data_get($curr, 'metric') === 'weight' ? $curr['volume'] : null,
                'previous_volume' => data_get($prev, 'metric') === 'weight' ? $prev['volume'] : null,
                'delta_kg' => $deltaKg,
                'delta_seconds' => $deltaSeconds,
                'delta_pct' => $deltaPct,
                'coach_note' => $this->exerciseNote($status, $deltaKg, $deltaPct, $metric, $direction),
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
            $label = 'Primera semana con números de verdad. Ahora toca repetir, que una vez la hace cualquiera.';
            $tip = 'La semana que viene, los mismos ejercicios. Si cambias todo, no hay con qué vacilarte.';
            $focus = 'A ver si repites';
        } elseif ($compared === 0) {
            $mood = 'orange';
            $label = 'Esta semana el informe está mudo. Sin kilos ni tiempos no hay de qué reírse.';
            $tip = 'Abre una sesión y apunta algo. El sofá no genera estadísticas.';
            $focus = 'Apunta algo';
        } elseif ($declined > $improved && $declined >= max(1, (int) ceil($compared * 0.4))) {
            $mood = 'red';
            $label = 'Varios ejercicios han bajado. O ha sido una semana perra, o te has venido arriba.';
            $tip = 'Duerme, come y baja un poco la carga una sesión. El récord puede esperar a que dejes de ir zombie.';
            $focus = 'Baja el ritmo';
        } elseif ($improved >= $maintained && $improved >= $declined) {
            $mood = 'green';
            $label = 'Estás subiendo en lo importante. No te vengas arriba y lo estropees el viernes.';
            $tip = 'Sigue igual una semana más. Sube peso cuando las series salgan limpias, no cuando te pique el ego.';
            $focus = 'Sigue picando';
        } else {
            $mood = 'orange';
            $label = 'Semana de seguir igual. Ni gloria ni desastre: el punto peligroso donde uno se duerme.';
            $tip = 'No cambies el plan. Busca una repe más antes de tocar los discos como si fueras otro.';
            $focus = 'No te duermas';
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
            ->sortByDesc(fn ($row) => $row['metric'] === 'time'
                ? abs((float) ($row['delta_seconds'] ?? 0))
                : abs((float) ($row['delta_kg'] ?? 0)))
            ->take(3)
            ->values()
            ->all();

        $watch = collect($exercises)
            ->where('status', 'declined')
            ->sortBy(fn ($row) => $row['metric'] === 'time'
                ? -abs((float) ($row['delta_seconds'] ?? 0))
                : (float) ($row['delta_kg'] ?? 0))
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

    private function exerciseNote(string $status, ?float $deltaKg, ?float $deltaPct, string $metric = 'weight', ?string $direction = null): string
    {
        if ($metric === 'time') {
            $longer = $direction === 'longer';

            return match ($status) {
                'improved' => $longer
                    ? 'Aguantas más. Cuando la postura siga decente, roba unos segundos más.'
                    : 'Has bajado el tiempo. Repite esa marca antes de hacerte el héroe.',
                'maintained' => 'Mismo tiempo. La próxima, aunque sean dos segundos. Que se note que lo intentas.',
                'declined' => $longer
                    ? 'Menos aguante. Huele a fatiga: hoy no es el día de hacerte el récord.'
                    : 'El tiempo ha subido. Recupera antes de perseguir la marca como si no doliera.',
                'new' => 'Primera marca. La semana que viene ya no tienes excusa de “era la primera vez”.',
                default => 'Apunta el tiempo. Sin cronómetro esto es teatro.',
            };
        }

        return match ($status) {
            'improved' => $deltaKg !== null
                ? 'Has subido. Si las reps salieron limpias, la próxima puedes picar un poco más.'
                : 'Subida anotada. No lo celebres cambiando la técnica a mitad.',
            'maintained' => 'Estás clavado. Mete una o dos reps más antes de tocar el peso para fardar.',
            'declined' => $deltaPct !== null && $deltaPct <= -5
                ? 'Menuda bajada. Baja la carga, haz el recorrido entero y duerme. El ego puede esperar.'
                : 'Un poco por debajo. Puede ser cansancio. Hoy no hace falta un récord para demostrar nada.',
            'new' => 'Primera vez que lo apuntas. La próxima semana ya se puede comparar, y vacilar.',
            default => 'Apunta las series enteras. A medias no cuenta ni para reírse.',
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
     * @return Collection<string, array{metric: string, time_direction: string|null, best_weight: float|null, best_seconds: int|null, volume: float, name: string, catalog_exercise_id: int|null}>
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
            ->where(function ($query) {
                $query->whereNotNull('weight_kg')->orWhereNotNull('duration_seconds');
            })
            ->get();

        return $logs
            ->groupBy(function (ExerciseSetLog $log) {
                $exercise = $log->routineExercise;
                if ($exercise?->catalog_exercise_id) {
                    return 'id:'.$exercise->catalog_exercise_id;
                }

                return 'name:'.mb_strtolower(trim($exercise?->name ?? 'ejercicio'));
            })
            ->map(function (Collection $group) {
                $first = $group->first()?->routineExercise;
                $mode = $first?->tracking_mode ?? 'weight_reps';
                $timed = in_array($mode, ['time', 'weight_time'], true);
                $direction = $first?->time_direction ?? 'faster';

                if ($timed) {
                    $timedLogs = $group->filter(fn (ExerciseSetLog $log) => $log->duration_seconds !== null);
                    if ($timedLogs->isEmpty()) {
                        return null;
                    }

                    $bestSeconds = $direction === 'longer'
                        ? (int) $timedLogs->max('duration_seconds')
                        : (int) $timedLogs->min('duration_seconds');

                    return [
                        'metric' => 'time',
                        'time_direction' => $direction,
                        'best_weight' => null,
                        'best_seconds' => $bestSeconds,
                        'volume' => 0.0,
                        'name' => $first?->name ?? 'Ejercicio',
                        'catalog_exercise_id' => $first?->catalog_exercise_id,
                    ];
                }

                $weighted = $group->filter(fn (ExerciseSetLog $log) => $log->weight_kg !== null);
                if ($weighted->isEmpty()) {
                    return null;
                }

                $volume = (float) $weighted->sum(function (ExerciseSetLog $log) {
                    return ((float) $log->weight_kg) * ((int) ($log->reps ?? 0));
                });

                return [
                    'metric' => 'weight',
                    'time_direction' => null,
                    'best_weight' => (float) $weighted->max('weight_kg'),
                    'best_seconds' => null,
                    'volume' => round($volume, 1),
                    'name' => $first?->name ?? 'Ejercicio',
                    'catalog_exercise_id' => $first?->catalog_exercise_id,
                ];
            })
            ->filter();
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
