<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkoutSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Datos de la pantalla de Progreso para un periodo (4, 12 o 52 semanas):
 * cifras frente al periodo anterior, semanas, mapa de constancia, récords y
 * evolución de fuerza (1RM estimado) por ejercicio.
 */
class ProgressOverviewService
{
    public const RANGES = [4, 12, 52];

    private const HEATMAP_WEEKS = 26;

    private const MAX_EXERCISES = 15;

    /** @return array<string, mixed> */
    public function overview(User $user, int $weeks, ?CarbonImmutable $today = null): array
    {
        $today = ($today ?? CarbonImmutable::today())->startOfDay();
        $weekStart = $today->startOfWeek(CarbonImmutable::MONDAY);
        $from = $weekStart->subWeeks($weeks - 1);
        $prevFrom = $from->subWeeks($weeks);

        $rows = $this->setRows($user);
        $sessions = $this->sessions($user);
        $records = $this->recordEvents($rows);

        $inRange = fn (string $date, CarbonImmutable $start, CarbonImmutable $end) => $date >= $start->toDateString() && $date <= $end->toDateString();
        $periodEnd = $today;
        $prevEnd = $from->subDay();

        return [
            'range_weeks' => $weeks,
            'period' => ['from' => $from->toDateString(), 'to' => $periodEnd->toDateString()],
            'kpis' => [
                'current' => $this->kpis($rows, $sessions, $records, fn ($d) => $inRange($d, $from, $periodEnd)),
                'previous' => $this->kpis($rows, $sessions, $records, fn ($d) => $inRange($d, $prevFrom, $prevEnd)),
            ],
            'weekly' => $this->weekly($rows, $sessions, $from, $weeks),
            'calendar' => $this->calendar($rows, $sessions, $weekStart, $today),
            'records' => $records->filter(fn ($r) => $inRange($r['date'], $from, $periodEnd))->sortByDesc('date')->take(8)->values()->all(),
            'exercises' => $this->strength($rows, $from, $periodEnd),
        ];
    }

    /**
     * Series con datos de toda la historia del usuario (los récords necesitan saber lo de antes).
     *
     * @return Collection<int, object>
     */
    private function setRows(User $user): Collection
    {
        $trainedOn = WorkoutSession::trainedOnSql();

        return DB::table('exercise_set_logs')
            ->join('workout_sessions', 'workout_sessions.id', '=', 'exercise_set_logs.workout_session_id')
            ->join('routine_exercises', 'routine_exercises.id', '=', 'exercise_set_logs.routine_exercise_id')
            ->leftJoin('catalog_exercises', 'catalog_exercises.id', '=', 'routine_exercises.catalog_exercise_id')
            ->leftJoin('exercises', 'exercises.id', '=', 'catalog_exercises.exercise_id')
            ->where('workout_sessions.user_id', $user->id)
            ->where('workout_sessions.tenant_id', $user->tenant_id)
            ->where(fn ($q) => $q->whereNull('exercise_set_logs.completed')->orWhere('exercise_set_logs.completed', true))
            ->where(fn ($q) => $q->whereNotNull('exercise_set_logs.weight_kg')
                ->orWhereNotNull('exercise_set_logs.reps')
                ->orWhereNotNull('exercise_set_logs.duration_seconds'))
            ->orderByRaw(WorkoutSession::trainedAtSql())
            ->orderBy('workout_sessions.id')
            ->orderBy('exercise_set_logs.set_number')
            ->get([
                DB::raw($trainedOn.' as trained_on'),
                'workout_sessions.id as session_id',
                'routine_exercises.id as routine_exercise_id',
                'routine_exercises.catalog_exercise_id',
                'routine_exercises.name',
                'routine_exercises.tracking_mode',
                'routine_exercises.target_muscle',
                'exercises.slug as library_slug',
                'exercises.has_image as library_has_image',
                'exercise_set_logs.weight_kg',
                'exercise_set_logs.reps',
            ])
            ->map(function (object $row) {
                $row->trained_on = substr((string) $row->trained_on, 0, 10);
                $row->weight_kg = $row->weight_kg !== null ? (float) $row->weight_kg : null;
                $row->reps = $row->reps !== null ? (int) $row->reps : null;
                $row->key = $row->catalog_exercise_id ? 'c'.$row->catalog_exercise_id : 'n'.ExerciseLogQuery::nameKey($row->name);

                return $row;
            });
    }

    /**
     * Sesiones que cuentan (completadas o con series), con su día y duración real.
     *
     * @return Collection<int, array{id: int, date: string, minutes: int|null}>
     */
    private function sessions(User $user): Collection
    {
        return WorkoutSession::query()
            ->where('user_id', $user->id)
            ->where(fn ($q) => $q->whereNotNull('completed_at')->orWhereHas('setLogs', fn ($l) => $l
                ->whereNotNull('weight_kg')->orWhereNotNull('reps')->orWhereNotNull('duration_seconds')))
            ->get(['id', 'scheduled_date', 'started_at', 'completed_at'])
            ->map(function (WorkoutSession $s) {
                $date = ($s->started_at ?? $s->completed_at ?? $s->scheduled_date)?->toDateString();
                $minutes = $s->started_at && $s->completed_at ? (int) round($s->started_at->diffInMinutes($s->completed_at)) : null;

                return [
                    'id' => $s->id,
                    'date' => (string) $date,
                    // Una sesión que se quedó abierta horas no es una duración real.
                    'minutes' => $minutes !== null && $minutes > 0 && $minutes <= 360 ? $minutes : null,
                ];
            });
    }

    /** @return array{workouts: int, sets: int, volume_kg: int, minutes: int, records: int} */
    private function kpis(Collection $rows, Collection $sessions, Collection $records, callable $inPeriod): array
    {
        $periodRows = $rows->filter(fn ($r) => $inPeriod($r->trained_on));
        $periodSessions = $sessions->filter(fn ($s) => $inPeriod($s['date']));

        return [
            'workouts' => $periodSessions->count(),
            'sets' => $periodRows->count(),
            'volume_kg' => (int) round($periodRows->sum(fn ($r) => ($r->weight_kg ?? 0) * ($r->reps ?? 0))),
            'minutes' => (int) $periodSessions->sum(fn ($s) => $s['minutes'] ?? 0),
            'records' => $records->filter(fn ($r) => $inPeriod($r['date']))->count(),
        ];
    }

    /** @return list<array{week_start: string, workouts: int, sets: int, volume_kg: int}> */
    private function weekly(Collection $rows, Collection $sessions, CarbonImmutable $from, int $weeks): array
    {
        $result = [];
        for ($i = 0; $i < $weeks; $i++) {
            $start = $from->addWeeks($i);
            $s = $start->toDateString();
            $e = $start->addDays(6)->toDateString();
            $weekRows = $rows->filter(fn ($r) => $r->trained_on >= $s && $r->trained_on <= $e);
            $result[] = [
                'week_start' => $s,
                'workouts' => $sessions->filter(fn ($x) => $x['date'] >= $s && $x['date'] <= $e)->count(),
                'sets' => $weekRows->count(),
                'volume_kg' => (int) round($weekRows->sum(fn ($r) => ($r->weight_kg ?? 0) * ($r->reps ?? 0))),
            ];
        }

        return $result;
    }

    /**
     * Mapa de constancia: series por día de las últimas 26 semanas (de lunes a hoy).
     *
     * @return array{from: string, to: string, days: array<string, int>}
     */
    private function calendar(Collection $rows, Collection $sessions, CarbonImmutable $weekStart, CarbonImmutable $today): array
    {
        $from = $weekStart->subWeeks(self::HEATMAP_WEEKS - 1)->toDateString();
        $to = $today->toDateString();

        $days = $rows->filter(fn ($r) => $r->trained_on >= $from && $r->trained_on <= $to)
            ->countBy('trained_on')
            ->all();
        // Sesiones completadas sin series apuntadas también cuentan como día entrenado.
        foreach ($sessions as $s) {
            if ($s['date'] >= $from && $s['date'] <= $to) {
                $days[$s['date']] ??= 1;
            }
        }
        ksort($days);

        return ['from' => $from, 'to' => $to, 'days' => $days];
    }

    /**
     * Récords de peso en orden cronológico: la mejor serie de una sesión que supera
     * el máximo anterior de ese ejercicio (la primera vez no cuenta como récord).
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function recordEvents(Collection $rows): Collection
    {
        $best = [];
        $events = [];
        $weighted = $rows->filter(fn ($r) => ($r->tracking_mode ?? 'weight_reps') === 'weight_reps' && ($r->weight_kg ?? 0) > 0);

        foreach ($weighted->groupBy('session_id') as $sessionRows) {
            foreach ($sessionRows->groupBy('key') as $key => $sets) {
                $top = $sets->sortByDesc(fn ($r) => [$r->weight_kg, $r->reps ?? 0])->first();
                if (isset($best[$key]) && $top->weight_kg > $best[$key]) {
                    $events[] = [
                        'date' => $top->trained_on,
                        'exercise' => $top->name,
                        'routine_exercise_id' => $top->routine_exercise_id,
                        'image_url' => $this->imageUrl($top),
                        'weight_kg' => $top->weight_kg,
                        'reps' => $top->reps,
                        'previous_kg' => $best[$key],
                    ];
                }
                $best[$key] = max($best[$key] ?? 0, $top->weight_kg);
            }
        }

        return collect($events);
    }

    /**
     * Evolución de fuerza por ejercicio en el periodo: la mejor serie de cada día por
     * 1RM estimado (Epley). Los ejercicios más entrenados primero.
     *
     * @return list<array<string, mixed>>
     */
    private function strength(Collection $rows, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $f = $from->toDateString();
        $t = $to->toDateString();
        $weighted = $rows->filter(fn ($r) => ($r->tracking_mode ?? 'weight_reps') === 'weight_reps' && ($r->weight_kg ?? 0) > 0 && ($r->reps ?? 0) > 0);
        $allTime = $weighted->groupBy('key')->map(fn ($sets) => $sets->max('weight_kg'));

        return $weighted
            ->filter(fn ($r) => $r->trained_on >= $f && $r->trained_on <= $t)
            ->groupBy('key')
            ->map(function (Collection $sets, string $key) use ($allTime) {
                $latest = $sets->last();
                $points = $sets->groupBy('trained_on')->map(function (Collection $day, string $date) {
                    $top = $day->sortByDesc(fn ($r) => ExerciseLogQuery::epley($r->weight_kg, $r->reps))->first();

                    return [
                        'date' => $date,
                        'e1rm' => round(ExerciseLogQuery::epley($top->weight_kg, $top->reps), 1),
                        'weight_kg' => $top->weight_kg,
                        'reps' => $top->reps,
                    ];
                })->values();
                $first = $points->first()['e1rm'];
                $last = $points->last()['e1rm'];

                return [
                    'key' => $key,
                    'name' => $latest->name,
                    'muscle' => $latest->target_muscle,
                    'image_url' => $this->imageUrl($latest),
                    'routine_exercise_id' => $latest->routine_exercise_id,
                    'sessions' => $points->count(),
                    'best_e1rm' => $points->max('e1rm'),
                    'best_weight_kg' => $sets->max('weight_kg'),
                    'all_time_best_kg' => $allTime[$key] ?? null,
                    'change_pct' => $points->count() > 1 && $first > 0 ? round(($last - $first) / $first * 100, 1) : null,
                    'points' => $points->all(),
                ];
            })
            ->sortBy([['sessions', 'desc'], ['name', 'asc']])
            ->take(self::MAX_EXERCISES)
            ->values()
            ->all();
    }

    private function imageUrl(object $row): ?string
    {
        return $row->library_slug && $row->library_has_image ? "/media/exercises/{$row->library_slug}/0.jpg" : null;
    }
}
