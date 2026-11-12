<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkoutSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Datos de motivación para el inicio (racha, último récord) y reparto por grupo muscular.
 *
 * Una sesión "cuenta" si está completada o tiene alguna serie con datos, y se
 * fecha por el día en que se entrenó de verdad (WorkoutSession::trainedOnSql).
 */
class TrainingHighlightsService
{
    /**
     * @return array<string, mixed>
     */
    public function highlights(User $user, ?CarbonImmutable $today = null): array
    {
        $today = ($today ?? WorkoutSession::localToday())->startOfDay();
        $days = $this->trainedDays($user);

        return [
            'streak' => $this->streak($days, $today),
            'last_record' => $this->lastRecord($user),
            'month' => [
                'sessions' => $days->filter(fn (string $d) => str_starts_with($d, $today->format('Y-m')))->count(),
            ],
        ];
    }

    /**
     * Resumen para la cabecera del perfil: total de días entrenados, racha y primer entreno.
     *
     * @return array{total_workouts: int, month_workouts: int, streak_weeks: int, best_streak_weeks: int, first_workout_on: ?string}
     */
    public function profileStats(User $user, ?CarbonImmutable $today = null): array
    {
        $today = ($today ?? WorkoutSession::localToday())->startOfDay();
        $days = $this->trainedDays($user);
        $streak = $this->streak($days, $today);

        return [
            'total_workouts' => $days->count(),
            'month_workouts' => $days->filter(fn (string $d) => str_starts_with($d, $today->format('Y-m')))->count(),
            'streak_weeks' => $streak['weeks'],
            'best_streak_weeks' => $streak['best'],
            'first_workout_on' => $days->last(),
        ];
    }

    /**
     * Series y volumen por grupo muscular, semana a semana (lunes a domingo).
     *
     * @return array<string, mixed>
     */
    public function muscles(User $user, int $weeks, ?CarbonImmutable $today = null): array
    {
        $today = ($today ?? WorkoutSession::localToday())->startOfDay();
        $currentWeek = $today->startOfWeek(CarbonImmutable::MONDAY);
        $from = $currentWeek->subWeeks($weeks - 1);
        $trainedOn = WorkoutSession::trainedOnSql();

        $rows = DB::table('exercise_set_logs')
            ->join('workout_sessions', 'workout_sessions.id', '=', 'exercise_set_logs.workout_session_id')
            ->join('routine_exercises', 'routine_exercises.id', '=', 'exercise_set_logs.routine_exercise_id')
            ->leftJoin('catalog_exercises', 'catalog_exercises.id', '=', 'routine_exercises.catalog_exercise_id')
            ->where('workout_sessions.user_id', $user->id)
            ->where('workout_sessions.tenant_id', $user->tenant_id)
            ->whereRaw($trainedOn.' >= ?', [$from->toDateString()])
            ->whereRaw($trainedOn.' <= ?', [$currentWeek->addDays(6)->toDateString()])
            ->where(function ($q) {
                $q->whereNotNull('exercise_set_logs.weight_kg')
                    ->orWhereNotNull('exercise_set_logs.reps')
                    ->orWhereNotNull('exercise_set_logs.duration_seconds');
            })
            ->select([
                DB::raw($trainedOn.' as trained_on'),
                DB::raw('COALESCE(routine_exercises.target_muscle, catalog_exercises.target_muscle) as muscle'),
                'exercise_set_logs.weight_kg',
                'exercise_set_logs.reps',
            ])
            ->get();

        $weekKeys = [];
        for ($w = $from; $w->lessThanOrEqualTo($currentWeek); $w = $w->addWeek()) {
            $weekKeys[] = $w->toDateString();
        }

        $byMuscle = [];
        foreach ($rows as $row) {
            $name = self::muscleName($row->muscle);
            $week = CarbonImmutable::parse(substr((string) $row->trained_on, 0, 10))->startOfWeek(CarbonImmutable::MONDAY)->toDateString();
            $byMuscle[$name] ??= ['name' => $name, 'sets' => 0, 'volume' => 0.0, 'weeks' => array_fill_keys($weekKeys, 0)];
            $byMuscle[$name]['sets']++;
            if (isset($byMuscle[$name]['weeks'][$week])) {
                $byMuscle[$name]['weeks'][$week]++;
            }
            if ($row->weight_kg !== null && $row->reps !== null) {
                $byMuscle[$name]['volume'] += (float) $row->weight_kg * (int) $row->reps;
            }
        }

        $muscles = collect($byMuscle)
            ->map(function (array $m) use ($weekKeys) {
                $weekly = array_values($m['weeks']);
                $recent = array_slice($weekly, -4);
                $previous = array_slice($weekly, -8, max(0, count($weekly) - 4));

                return [
                    'name' => $m['name'],
                    'sets' => $m['sets'],
                    'volume' => round($m['volume']),
                    'avg_sets_per_week' => round(array_sum($recent) / max(1, count($recent)), 1),
                    'prev_avg_sets_per_week' => count($previous) > 0 ? round(array_sum($previous) / count($previous), 1) : null,
                    'weekly_sets' => array_map(
                        fn ($week, $sets) => ['week' => $week, 'sets' => $sets],
                        $weekKeys,
                        $weekly,
                    ),
                ];
            })
            ->sortByDesc('sets')
            ->values()
            ->all();

        return [
            'from' => $from->toDateString(),
            'to' => $currentWeek->addDays(6)->toDateString(),
            'weeks' => $weekKeys,
            'muscles' => $muscles,
        ];
    }

    public static function muscleName(?string $raw): string
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return 'Sin grupo';
        }

        return mb_strtoupper(mb_substr($raw, 0, 1)).mb_strtolower(mb_substr($raw, 1));
    }

    /**
     * Días (Y-m-d) con entrenamiento real, sin repetir, del más reciente al más antiguo.
     *
     * @return Collection<int, string>
     */
    private function trainedDays(User $user): Collection
    {
        $trainedOn = WorkoutSession::trainedOnSql();

        // Sin el filtro de tenant de quien consulta: también se usa para ver el perfil de
        // otra persona, y ya se filtra por su user_id.
        return WorkoutSession::query()
            ->withoutGlobalScope('tenant')
            ->where('user_id', $user->id)
            ->where(function ($query) {
                $query->whereNotNull('completed_at')
                    ->orWhereHas('setLogs', function ($q) {
                        $q->withoutGlobalScope('tenant')
                            ->where(fn ($inner) => $inner->whereNotNull('weight_kg')->orWhereNotNull('reps')->orWhereNotNull('duration_seconds'));
                    });
            })
            ->selectRaw($trainedOn.' as trained_on')
            ->distinct()
            ->orderByDesc('trained_on')
            ->pluck('trained_on')
            ->map(fn ($d) => substr((string) $d, 0, 10))
            ->unique()
            ->values();
    }

    /**
     * Semanas seguidas (lunes a domingo) con al menos un entrenamiento. La semana en curso
     * no rompe la racha mientras no haya terminado.
     *
     * @param  Collection<int, string>  $days
     * @return array{weeks: int, this_week: int, best: int, active: bool}
     */
    private function streak(Collection $days, CarbonImmutable $today): array
    {
        $weeks = $days
            ->map(fn (string $d) => CarbonImmutable::parse($d)->startOfWeek(CarbonImmutable::MONDAY)->toDateString())
            ->countBy();

        $currentWeek = $today->startOfWeek(CarbonImmutable::MONDAY);
        $thisWeek = (int) ($weeks[$currentWeek->toDateString()] ?? 0);

        $streak = $thisWeek > 0 ? 1 : 0;
        for ($w = $currentWeek->subWeek(); isset($weeks[$w->toDateString()]); $w = $w->subWeek()) {
            $streak++;
        }

        $best = 0;
        $run = 0;
        $previous = null;
        foreach ($weeks->keys()->sort()->values() as $week) {
            $date = CarbonImmutable::parse($week);
            $run = $previous !== null && $previous->addWeek()->isSameDay($date) ? $run + 1 : 1;
            $best = max($best, $run);
            $previous = $date;
        }

        return [
            'weeks' => $streak,
            'this_week' => $thisWeek,
            'best' => max($best, $streak),
            // La racha sigue viva si esta semana o la anterior hubo entreno.
            'active' => $streak > 0,
        ];
    }

    /**
     * Último récord de peso: la serie más reciente que superó el máximo anterior de ese ejercicio.
     *
     * @return array<string, mixed>|null
     */
    private function lastRecord(User $user): ?array
    {
        $trainedAt = WorkoutSession::trainedAtSql();

        $rows = DB::table('exercise_set_logs')
            ->join('workout_sessions', 'workout_sessions.id', '=', 'exercise_set_logs.workout_session_id')
            ->join('routine_exercises', 'routine_exercises.id', '=', 'exercise_set_logs.routine_exercise_id')
            ->where('workout_sessions.user_id', $user->id)
            ->where('workout_sessions.tenant_id', $user->tenant_id)
            ->where('routine_exercises.tracking_mode', 'weight_reps')
            ->whereNotNull('exercise_set_logs.weight_kg')
            ->where('exercise_set_logs.weight_kg', '>', 0)
            ->orderByRaw($trainedAt)
            ->orderBy('workout_sessions.id')
            ->orderBy('exercise_set_logs.set_number')
            ->select([
                DB::raw($trainedAt.' as trained_at'),
                'routine_exercises.id as routine_exercise_id',
                'routine_exercises.catalog_exercise_id',
                'routine_exercises.name',
                'exercise_set_logs.weight_kg',
                'exercise_set_logs.reps',
                'workout_sessions.id as session_id',
            ])
            ->get();

        $best = [];
        $last = null;
        foreach ($rows as $row) {
            $key = $row->catalog_exercise_id ? 'c'.$row->catalog_exercise_id : 'n'.mb_strtolower(trim($row->name));
            $weight = (float) $row->weight_kg;
            if (isset($best[$key]) && $weight > $best[$key]['weight']) {
                // Varias series récord en la misma sesión: cuenta la mejor, comparada con el récord de antes de esa sesión.
                $sameSession = $last !== null && $last['key'] === $key && $last['session_id'] === $row->session_id;
                $previousKg = $sameSession ? $last['previous_kg'] : $best[$key]['weight'];
                $last = [
                    'key' => $key,
                    'exercise' => $row->name,
                    'routine_exercise_id' => $row->routine_exercise_id,
                    'session_id' => $row->session_id,
                    'weight_kg' => $weight,
                    'reps' => $row->reps !== null ? (int) $row->reps : null,
                    'previous_kg' => $previousKg,
                    'date' => substr((string) $row->trained_at, 0, 10),
                ];
            }
            if (! isset($best[$key]) || $weight > $best[$key]['weight']) {
                $best[$key] = ['weight' => $weight];
            }
        }

        if ($last === null) {
            return null;
        }
        unset($last['key']);

        return $last;
    }
}
