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
