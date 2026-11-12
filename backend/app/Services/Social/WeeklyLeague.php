<?php

namespace App\Services\Social;

use App\Models\User;
use App\Models\WorkoutSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Liga semanal entre amigos: quién ha entrenado más días, movido más kilos o batido más
 * récords de lunes a domingo. No hay que crear nada: participan tú y los amigos que comparten
 * su actividad contigo (los perfiles privados y los bloqueados no salen).
 */
class WeeklyLeague
{
    public const MAX_WEEKS_AGO = 12;

    public function __construct(private readonly SocialGraph $graph) {}

    /**
     * @return array{week: array<string, mixed>, entries: list<array<string, mixed>>}
     */
    public function standings(User $viewer, int $weeksAgo = 0, ?CarbonImmutable $today = null): array
    {
        $today = ($today ?? WorkoutSession::localToday())->startOfDay();
        $from = $today->startOfWeek(CarbonImmutable::MONDAY)->subWeeks($weeksAgo);
        $to = $from->addDays(6);

        $participants = $this->participants($viewer);
        $ids = $participants->pluck('id')->all();

        $days = $this->trainedDays($ids, $from, $to);
        $sets = $this->setTotals($ids, $from, $to);
        $records = $this->records($ids, $from, $to);

        $entries = $participants
            ->map(fn (User $user) => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'avatar_url' => $user->avatarUrl(),
                ],
                'me' => $user->id === $viewer->id,
                'days' => (int) ($days[$user->id] ?? 0),
                'sets' => (int) ($sets[$user->id]['sets'] ?? 0),
                'volume_kg' => (int) round($sets[$user->id]['volume'] ?? 0),
                'records' => (int) ($records[$user->id] ?? 0),
            ])
            ->values()
            ->all();

        return [
            'week' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'weeks_ago' => $weeksAgo,
                'current' => $weeksAgo === 0,
                // Días que quedan contando hoy (0 si la semana ya terminó).
                'days_left' => $weeksAgo === 0 ? (int) $today->diffInDays($to) + 1 : 0,
            ],
            'entries' => $entries,
        ];
    }

    /** Modalidades: puntuación principal y desempates, de más a menos importante. */
    private const METRICS = [
        'days' => ['days', 'sets', 'volume_kg'],
        'volume' => ['volume_kg', 'days', 'sets'],
        'records' => ['records', 'days', 'sets'],
    ];

    /**
     * Puesto de cada participante en una modalidad. Quien empata en todo comparte puesto;
     * quien no ha puntuado no tiene puesto (null).
     *
     * @param  list<array<string, mixed>>  $entries
     * @return array<int, int|null> id de usuario => puesto
     */
    public function positions(array $entries, string $metric): array
    {
        $keys = self::METRICS[$metric];
        $score = fn (array $entry) => array_map(fn (string $key) => (int) $entry[$key], $keys);

        usort($entries, fn (array $a, array $b) => $score($b) <=> $score($a));

        $positions = [];
        $position = 0;
        $previous = null;
        foreach ($entries as $index => $entry) {
            $current = $score($entry);
            if ($current !== $previous) {
                $position = $index + 1;
            }
            $previous = $current;
            $positions[$entry['user']['id']] = $current[0] > 0 ? $position : null;
        }

        return $positions;
    }

    /**
     * Semanas ya cerradas de una persona, de la más reciente a la más antigua.
     *
     * @return list<array<string, mixed>>
     */
    public function history(User $user, ?CarbonImmutable $today = null): array
    {
        $this->settle($user, $today);

        return DB::table('league_results')
            ->where('user_id', $user->id)
            ->orderByDesc('week_start')
            ->limit(self::MAX_WEEKS_AGO)
            ->get()
            ->map(fn ($row) => [
                'week_start' => substr((string) $row->week_start, 0, 10),
                'week_end' => CarbonImmutable::parse($row->week_start)->addDays(6)->toDateString(),
                'participants' => (int) $row->participants,
                'positions' => [
                    'days' => $row->position_days !== null ? (int) $row->position_days : null,
                    'volume' => $row->position_volume !== null ? (int) $row->position_volume : null,
                    'records' => $row->position_records !== null ? (int) $row->position_records : null,
                ],
                'days' => (int) $row->days,
                'sets' => (int) $row->sets,
                'volume_kg' => (int) $row->volume_kg,
                'records' => (int) $row->records,
            ])
            ->all();
    }

    /** Semanas ganadas: primer puesto por días entrenados compitiendo al menos con un amigo. */
    public function wins(User $user, ?CarbonImmutable $today = null): int
    {
        $this->settle($user, $today);

        return DB::table('league_results')
            ->where('user_id', $user->id)
            ->where('position_days', 1)
            ->where('participants', '>', 1)
            ->count();
    }

    /**
     * Cierra las semanas terminadas que aún no tienen resultado guardado (las últimas 12 y
     * solo desde que existe la cuenta). Se hace al consultarlo: no hace falta ninguna tarea programada.
     */
    private function settle(User $user, ?CarbonImmutable $today = null): void
    {
        $today = ($today ?? WorkoutSession::localToday())->startOfDay();
        $currentWeek = $today->startOfWeek(CarbonImmutable::MONDAY);
        $since = $user->created_at?->toDateString();

        $stored = DB::table('league_results')
            ->where('user_id', $user->id)
            ->where('week_start', '>=', $currentWeek->subWeeks(self::MAX_WEEKS_AGO)->toDateString())
            ->pluck('week_start')
            ->map(fn ($date) => substr((string) $date, 0, 10))
            ->flip();

        for ($weeksAgo = 1; $weeksAgo <= self::MAX_WEEKS_AGO; $weeksAgo++) {
            $weekStart = $currentWeek->subWeeks($weeksAgo);
            if ($since !== null && $weekStart->addDays(6)->toDateString() < $since) {
                break;
            }
            if (isset($stored[$weekStart->toDateString()])) {
                continue;
            }

            $entries = $this->standings($user, $weeksAgo, $today)['entries'];
            $mine = collect($entries)->firstWhere('me', true);
            $now = now();

            // insertOrIgnore: si dos peticiones lo cierran a la vez, la segunda no falla.
            DB::table('league_results')->insertOrIgnore([
                'user_id' => $user->id,
                'week_start' => $weekStart->toDateString(),
                'participants' => count($entries),
                'position_days' => $this->positions($entries, 'days')[$user->id],
                'position_volume' => $this->positions($entries, 'volume')[$user->id],
                'position_records' => $this->positions($entries, 'records')[$user->id],
                'days' => $mine['days'],
                'sets' => $mine['sets'],
                'volume_kg' => $mine['volume_kg'],
                'records' => $mine['records'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /** Tú y los amigos que te dejan ver su actividad. @return \Illuminate\Support\Collection<int, User> */
    private function participants(User $viewer)
    {
        $hidden = $this->graph->hiddenIds($viewer);
        $friendIds = array_values(array_diff($this->graph->friendIds($viewer), $hidden));

        // Sin el filtro de espacio de quien consulta: los amigos viven en el suyo.
        $friends = $friendIds === []
            ? collect()
            : User::query()->whereIn('id', $friendIds)->get()
                ->filter(fn (User $friend) => $this->graph->canViewActivity($viewer, $friend));

        return collect([$viewer])->concat($friends)->values();
    }

    /**
     * Días distintos con entrenamiento real (completado o con alguna serie apuntada).
     *
     * @param  list<int>  $ids
     * @return array<int, int>
     */
    private function trainedDays(array $ids, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $trainedOn = WorkoutSession::trainedOnSql();

        return DB::table('workout_sessions')
            ->whereIn('workout_sessions.user_id', $ids)
            ->whereRaw($trainedOn.' between ? and ?', [$from->toDateString(), $to->toDateString()])
            ->where(function ($query) {
                $query->whereNotNull('workout_sessions.completed_at')
                    ->orWhereExists(function ($logs) {
                        $logs->select(DB::raw(1))
                            ->from('exercise_set_logs')
                            ->whereColumn('exercise_set_logs.workout_session_id', 'workout_sessions.id')
                            ->where(fn ($q) => $q->whereNotNull('weight_kg')->orWhereNotNull('reps')->orWhereNotNull('duration_seconds'));
                    });
            })
            ->groupBy('workout_sessions.user_id')
            ->selectRaw('workout_sessions.user_id as user_id, COUNT(DISTINCT '.$trainedOn.') as days')
            ->pluck('days', 'user_id')
            ->all();
    }

    /**
     * Series con datos y kilos movidos (kg × repeticiones) en la semana.
     *
     * @param  list<int>  $ids
     * @return array<int, array{sets: int, volume: float}>
     */
    private function setTotals(array $ids, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return DB::table('exercise_set_logs')
            ->join('workout_sessions', 'workout_sessions.id', '=', 'exercise_set_logs.workout_session_id')
            ->whereIn('workout_sessions.user_id', $ids)
            ->whereRaw(WorkoutSession::trainedOnSql().' between ? and ?', [$from->toDateString(), $to->toDateString()])
            ->where(fn ($q) => $q->whereNotNull('exercise_set_logs.weight_kg')
                ->orWhereNotNull('exercise_set_logs.reps')
                ->orWhereNotNull('exercise_set_logs.duration_seconds'))
            ->groupBy('workout_sessions.user_id')
            ->selectRaw('workout_sessions.user_id as user_id, COUNT(*) as sets, SUM(COALESCE(exercise_set_logs.weight_kg, 0) * COALESCE(exercise_set_logs.reps, 0)) as volume')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->user_id => ['sets' => (int) $row->sets, 'volume' => (float) $row->volume]])
            ->all();
    }

    /**
     * Récords de peso de la semana: ejercicios en los que se superó el máximo que se tenía antes.
     * La primera vez que se hace un ejercicio no cuenta (no hay marca que batir).
     *
     * @param  list<int>  $ids
     * @return array<int, int>
     */
    private function records(array $ids, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $trainedOn = WorkoutSession::trainedOnSql();
        $exerciseName = "CASE WHEN routine_exercises.catalog_exercise_id IS NULL THEN LOWER(TRIM(routine_exercises.name)) ELSE '' END";

        $rows = DB::table('exercise_set_logs')
            ->join('workout_sessions', 'workout_sessions.id', '=', 'exercise_set_logs.workout_session_id')
            ->join('routine_exercises', 'routine_exercises.id', '=', 'exercise_set_logs.routine_exercise_id')
            ->whereIn('workout_sessions.user_id', $ids)
            ->where('routine_exercises.tracking_mode', 'weight_reps')
            ->where('exercise_set_logs.weight_kg', '>', 0)
            ->whereRaw($trainedOn.' <= ?', [$to->toDateString()])
            ->groupBy('workout_sessions.user_id', DB::raw('COALESCE(routine_exercises.catalog_exercise_id, 0)'), DB::raw($exerciseName))
            ->selectRaw('workout_sessions.user_id as user_id')
            ->selectRaw('MAX(CASE WHEN '.$trainedOn.' < ? THEN exercise_set_logs.weight_kg END) as before_kg', [$from->toDateString()])
            ->selectRaw('MAX(CASE WHEN '.$trainedOn.' >= ? THEN exercise_set_logs.weight_kg END) as week_kg', [$from->toDateString()])
            ->get();

        $counts = [];
        foreach ($rows as $row) {
            if ($row->before_kg !== null && $row->week_kg !== null && (float) $row->week_kg > (float) $row->before_kg) {
                $counts[(int) $row->user_id] = ($counts[(int) $row->user_id] ?? 0) + 1;
            }
        }

        return $counts;
    }
}
