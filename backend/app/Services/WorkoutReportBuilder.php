<?php

namespace App\Services;

use App\Models\ExerciseSetLog;
use App\Models\User;
use App\Models\WorkoutSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Prepara los datos de un informe PDF de entrenamiento (una sesión o un periodo).
 *
 * Las sesiones se agrupan por su fecha en la agenda (scheduled_date), igual que
 * las ve el usuario en el calendario. Solo entran las que tienen datos: series
 * registradas o la sesión marcada como completada.
 */
class WorkoutReportBuilder
{
    private const MAX_SESSION_MINUTES = 6 * 60;

    /**
     * @return array<string, mixed>|null null si no hay entrenamientos en el periodo
     */
    public function forRange(User $user, CarbonImmutable $from, CarbonImmutable $to, string $timezone): ?array
    {
        $sessions = $this->sessionsBetween($user, $from, $to);

        if ($sessions->isEmpty()) {
            return null;
        }

        $period = $this->period($from, $to);
        $built = $sessions->map(fn (WorkoutSession $session) => $this->session($session, $timezone));

        $previous = null;
        if ($period['kind'] !== 'day') {
            $days = $from->diffInDays($to) + 1;
            $prevSessions = $this->sessionsBetween($user, $from->subDays($days), $from->subDay())
                ->map(fn (WorkoutSession $session) => $this->session($session, $timezone));
            $previous = $this->totals($prevSessions);
        }

        return [
            'type' => 'range',
            'user' => $user,
            'period' => $period,
            'timezone' => $timezone,
            'generatedAt' => CarbonImmutable::now($timezone),
            'totals' => $this->totals($built),
            'previous' => $previous,
            'sessions' => $built->values()->all(),
            'activity' => $period['kind'] === 'day' ? null : $this->daily($built, $from, $to),
            'exercises' => $this->exerciseSummary($built),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function forSession(User $user, WorkoutSession $session, string $timezone): array
    {
        $session->loadMissing(['routine', 'day', 'setLogs.routineExercise']);
        $built = collect([$this->session($session, $timezone)]);
        $date = CarbonImmutable::parse($session->scheduled_date->toDateString());

        return [
            'type' => 'session',
            'user' => $user,
            'period' => $this->period($date, $date),
            'timezone' => $timezone,
            'generatedAt' => CarbonImmutable::now($timezone),
            'totals' => $this->totals($built),
            'previous' => null,
            'sessions' => $built->all(),
            'activity' => null,
            'exercises' => [],
        ];
    }

    public function sessionHasData(WorkoutSession $session): bool
    {
        return $session->completed_at !== null
            || $session->setLogs()->where(fn ($q) => $this->whereHasValues($q))->exists();
    }

    /**
     * @return array{kind: string, label: string, title: string, slug: string, from: CarbonImmutable, to: CarbonImmutable}
     */
    public function period(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $from = $from->locale('es');
        $to = $to->locale('es');

        if ($from->isSameDay($to)) {
            return [
                'kind' => 'day',
                'label' => 'Informe diario',
                'title' => ucfirst($from->isoFormat('dddd, D [de] MMMM [de] YYYY')),
                'slug' => 'dia-'.$from->toDateString(),
                'from' => $from,
                'to' => $to,
            ];
        }

        if ($from->isMonday() && $to->isSameDay($from->addDays(6))) {
            $sameMonth = $from->month === $to->month;

            return [
                'kind' => 'week',
                'label' => 'Informe semanal',
                'title' => 'Semana del '.($sameMonth
                    ? $from->isoFormat('D').' al '.$to->isoFormat('D [de] MMMM [de] YYYY')
                    : $from->isoFormat('D [de] MMMM').' al '.$to->isoFormat('D [de] MMMM [de] YYYY')),
                'slug' => 'semana-'.$from->toDateString(),
                'from' => $from,
                'to' => $to,
            ];
        }

        if ($from->day === 1 && $to->isSameDay($from->endOfMonth())) {
            return [
                'kind' => 'month',
                'label' => 'Informe mensual',
                'title' => ucfirst($from->isoFormat('MMMM [de] YYYY')),
                'slug' => 'mes-'.$from->format('Y-m'),
                'from' => $from,
                'to' => $to,
            ];
        }

        return [
            'kind' => 'custom',
            'label' => 'Informe del periodo',
            'title' => $from->isoFormat('D MMM YYYY').' – '.$to->isoFormat('D MMM YYYY'),
            'slug' => $from->toDateString().'_'.$to->toDateString(),
            'from' => $from,
            'to' => $to,
        ];
    }

    /**
     * @return Collection<int, WorkoutSession>
     */
    private function sessionsBetween(User $user, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return WorkoutSession::query()
            ->with(['routine', 'day', 'setLogs.routineExercise'])
            ->where('user_id', $user->id)
            ->whereDate('scheduled_date', '>=', $from->toDateString())
            ->whereDate('scheduled_date', '<=', $to->toDateString())
            ->where(function ($query) {
                $query->whereNotNull('completed_at')
                    ->orWhereHas('setLogs', fn ($q) => $this->whereHasValues($q));
            })
            ->orderBy('scheduled_date')
            ->orderByRaw('COALESCE(started_at, completed_at) IS NULL')
            ->orderBy('started_at')
            ->orderBy('id')
            ->get();
    }

    private function whereHasValues($query): void
    {
        $query->where(function ($q) {
            $q->whereNotNull('weight_kg')->orWhereNotNull('reps')->orWhereNotNull('duration_seconds');
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function session(WorkoutSession $session, string $timezone): array
    {
        $logs = $session->setLogs
            ->filter(fn (ExerciseSetLog $log) => $log->weight_kg !== null || $log->reps !== null || $log->duration_seconds !== null)
            ->filter(fn (ExerciseSetLog $log) => $log->routineExercise !== null);

        $exercises = $logs
            ->groupBy('routine_exercise_id')
            ->map(fn (Collection $group) => $this->exercise($group))
            ->sortBy([['order', 'asc'], ['name', 'asc']])
            ->values();

        $startedAt = $session->started_at?->toImmutable()->setTimezone($timezone);
        $completedAt = $session->completed_at?->toImmutable()->setTimezone($timezone);
        $minutes = null;
        if ($startedAt && $completedAt && $completedAt->greaterThan($startedAt)) {
            $diff = (int) round($startedAt->diffInMinutes($completedAt));
            $minutes = $diff > 0 && $diff <= self::MAX_SESSION_MINUTES ? $diff : null;
        }

        $date = CarbonImmutable::parse($session->scheduled_date->toDateString())->locale('es');
        $trainedOn = $startedAt ?? $completedAt;
        $doneOtherDay = $trainedOn !== null && $trainedOn->toDateString() !== $date->toDateString();

        $rpes = $logs->pluck('rpe')->filter(fn ($rpe) => $rpe !== null)->map(fn ($rpe) => (float) $rpe);

        return [
            'id' => $session->id,
            'date' => $date,
            'routine' => $session->routine?->name ?? 'Rutina',
            'day' => $session->day?->name ?? 'Entrenamiento',
            'focus' => $session->day?->focus,
            'startedAt' => $startedAt,
            'completedAt' => $completedAt,
            'trainedOn' => $doneOtherDay ? $trainedOn->locale('es') : null,
            'minutes' => $minutes,
            'completed' => $session->completed_at !== null,
            'swapped' => (bool) $session->was_swapped,
            'notes' => $session->notes,
            'exercises' => $exercises->all(),
            'sets' => $logs->count(),
            'reps' => (int) $exercises->sum('reps'),
            'volume' => (float) $exercises->sum('volume'),
            'seconds' => (int) $exercises->sum('seconds'),
            'avgRpe' => $rpes->isNotEmpty() ? round($rpes->avg(), 1) : null,
        ];
    }

    /**
     * @param  Collection<int, ExerciseSetLog>  $logs
     * @return array<string, mixed>
     */
    private function exercise(Collection $logs): array
    {
        $exercise = $logs->first()->routineExercise;
        $mode = $exercise->tracking_mode ?: 'weight_reps';
        $direction = $exercise->time_direction ?: 'faster';

        $sets = $logs->sortBy('set_number')->values()->map(function (ExerciseSetLog $log) {
            $weight = $log->weight_kg !== null ? (float) $log->weight_kg : null;
            $reps = $log->reps !== null ? (int) $log->reps : null;

            return [
                'number' => (int) $log->set_number,
                'weight' => $weight,
                'reps' => $reps,
                'seconds' => $log->duration_seconds,
                'rpe' => $log->rpe !== null ? (float) $log->rpe : null,
                'notes' => $log->notes,
                'completed' => (bool) $log->completed,
                'volume' => $weight !== null && $reps !== null ? $weight * $reps : 0.0,
                'e1rm' => $weight !== null && $reps !== null && $reps > 0 && $reps <= 12
                    ? $weight * (1 + $reps / 30)
                    : null,
            ];
        });

        $best = null;
        if ($mode === 'weight_reps') {
            $best = $sets->filter(fn ($s) => $s['weight'] !== null)
                ->sortByDesc(fn ($s) => [$s['weight'], $s['reps'] ?? 0])
                ->first();
        } else {
            $timed = $sets->filter(fn ($s) => $s['seconds'] !== null);
            $best = $direction === 'longer'
                ? $timed->sortByDesc('seconds')->first()
                : $timed->sortBy('seconds')->first();
        }

        return [
            'key' => $exercise->catalog_exercise_id
                ? 'c'.$exercise->catalog_exercise_id
                : 'n'.mb_strtolower(trim($exercise->name)),
            'name' => $exercise->name,
            'muscle' => $exercise->target_muscle,
            'order' => (int) $exercise->sort_order,
            'mode' => $mode,
            'direction' => $direction,
            'plan' => $this->planLabel($exercise),
            'sets' => $sets->all(),
            'setCount' => $sets->count(),
            'reps' => (int) $sets->sum(fn ($s) => $s['reps'] ?? 0),
            'volume' => (float) $sets->sum('volume'),
            'seconds' => (int) $sets->sum(fn ($s) => $s['seconds'] ?? 0),
            'topWeight' => $sets->max('weight'),
            'e1rm' => $sets->max('e1rm'),
            'best' => $best,
        ];
    }

    private function planLabel($exercise): string
    {
        $mode = $exercise->tracking_mode ?: 'weight_reps';
        if ($mode === 'weight_reps') {
            return $exercise->default_sets.' × '.$exercise->default_reps;
        }
        $goal = $exercise->default_duration_seconds
            ? ' · objetivo '.self::duration($exercise->default_duration_seconds)
            : '';

        return $exercise->default_sets.' series'.$goal;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $sessions
     * @return array<string, mixed>
     */
    private function totals(Collection $sessions): array
    {
        $minutes = $sessions->pluck('minutes')->filter();

        return [
            'sessions' => $sessions->count(),
            'completed' => $sessions->where('completed', true)->count(),
            'days' => $sessions->map(fn ($s) => $s['date']->toDateString())->unique()->count(),
            'sets' => (int) $sessions->sum('sets'),
            'reps' => (int) $sessions->sum('reps'),
            'volume' => (float) $sessions->sum('volume'),
            'seconds' => (int) $sessions->sum('seconds'),
            'minutes' => (int) $minutes->sum(),
            'avgMinutes' => $minutes->isNotEmpty() ? (int) round($minutes->avg()) : null,
            'exercises' => $sessions->flatMap(fn ($s) => collect($s['exercises'])->pluck('key'))->unique()->count(),
        ];
    }

    /**
     * Actividad del periodo: una fila por día (hasta 7 días) o por semana (periodos largos).
     *
     * @param  Collection<int, array<string, mixed>>  $sessions
     * @return array{granularity: string, rows: array<int, array<string, mixed>>}
     */
    private function daily(Collection $sessions, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $from = $from->locale('es');
        $to = $to->locale('es');
        $byWeek = $from->diffInDays($to) + 1 > 7;
        $rows = [];

        if ($byWeek) {
            for ($start = $from; $start->lessThanOrEqualTo($to); $start = $end->addDay()) {
                $end = $start->endOfWeek(CarbonImmutable::SUNDAY)->startOfDay();
                if ($end->greaterThan($to)) {
                    $end = $to;
                }
                $list = $sessions->filter(fn ($s) => $s['date']->betweenIncluded($start, $end));
                $rows[] = $this->activityRow($list, $start, $end) + [
                    'title' => $start->isSameDay($end)
                        ? str_replace('.', '', $start->isoFormat('ddd D MMM'))
                        : $start->isoFormat('D').'–'.str_replace('.', '', $end->isoFormat('D MMM')),
                    'label' => $list->isEmpty()
                        ? 'Sin entrenamientos'
                        : $list->count().' '.($list->count() === 1 ? 'sesión' : 'sesiones').' · '
                            .$list->map(fn ($s) => $s['day'])->unique()->implode(', '),
                ];
            }
        } else {
            $byDate = $sessions->groupBy(fn ($s) => $s['date']->toDateString());
            for ($day = $from; $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
                $list = $byDate->get($day->toDateString(), collect());
                $rows[] = $this->activityRow($list, $day, $day) + [
                    'title' => str_replace('.', '', $day->isoFormat('ddd D MMM')),
                    'label' => $list->isEmpty() ? 'Descanso' : $list->map(fn ($s) => $s['day'])->implode(' + '),
                ];
            }
        }

        $max = max(1.0, (float) collect($rows)->max('volume'));
        $maxSets = max(1, (int) collect($rows)->max('sets'));

        $rows = array_map(function ($row) use ($max, $maxSets) {
            $row['bar'] = $row['volume'] > 0
                ? max(2, (int) round($row['volume'] / $max * 100))
                : ($row['sets'] > 0 ? max(2, (int) round($row['sets'] / $maxSets * 100)) : 0);

            return $row;
        }, $rows);

        return ['granularity' => $byWeek ? 'week' : 'day', 'rows' => $rows];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $list
     * @return array<string, mixed>
     */
    private function activityRow(Collection $list, CarbonImmutable $start, CarbonImmutable $end): array
    {
        return [
            'start' => $start,
            'end' => $end,
            'sessions' => $list->count(),
            'sets' => (int) $list->sum('sets'),
            'volume' => (float) $list->sum('volume'),
            'minutes' => (int) $list->sum(fn ($s) => $s['minutes'] ?? 0),
        ];
    }

    /**
     * Resumen por ejercicio en todo el periodo (mismo ejercicio = mismo catálogo o nombre).
     *
     * @param  Collection<int, array<string, mixed>>  $sessions
     * @return array<int, array<string, mixed>>
     */
    private function exerciseSummary(Collection $sessions): array
    {
        return $sessions
            ->flatMap(fn ($s) => collect($s['exercises'])->map(fn ($e) => $e + ['sessionDate' => $s['date']]))
            ->groupBy('key')
            ->map(function (Collection $entries) {
                $first = $entries->first();
                $mode = $first['mode'];
                $direction = $first['direction'];
                $bests = $entries->pluck('best')->filter();

                if ($mode === 'weight_reps') {
                    $best = $bests->filter(fn ($b) => $b['weight'] !== null)
                        ->sortByDesc(fn ($b) => [$b['weight'], $b['reps'] ?? 0])->first();
                } else {
                    $timed = $bests->filter(fn ($b) => $b['seconds'] !== null);
                    $best = $direction === 'longer' ? $timed->sortByDesc('seconds')->first() : $timed->sortBy('seconds')->first();
                }

                return [
                    'name' => $first['name'],
                    'muscle' => $first['muscle'],
                    'mode' => $mode,
                    'sessions' => $entries->count(),
                    'sets' => (int) $entries->sum('setCount'),
                    'reps' => (int) $entries->sum('reps'),
                    'volume' => (float) $entries->sum('volume'),
                    'seconds' => (int) $entries->sum('seconds'),
                    'e1rm' => $entries->max('e1rm'),
                    'best' => $best,
                ];
            })
            ->sortBy([['volume', 'desc'], ['sets', 'desc'], ['name', 'asc']])
            ->values()
            ->all();
    }

    public static function duration(?int $seconds): string
    {
        if ($seconds === null) {
            return '—';
        }
        $seconds = max(0, $seconds);
        if ($seconds >= 3600) {
            return sprintf('%d:%02d:%02d', intdiv($seconds, 3600), intdiv($seconds % 3600, 60), $seconds % 60);
        }

        return sprintf('%d:%02d', intdiv($seconds, 60), $seconds % 60);
    }
}
