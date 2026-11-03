<?php

namespace App\Services;

use App\Models\Routine;
use App\Models\User;
use App\Models\WorkoutSession;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class TrainingCalendarPlanner
{
    /**
     * Genera sesiones de todas las rutinas activas vigentes.
     * No pisa sesiones ya creadas/editadas. Limpia planificados de rutinas pausadas.
     */
    public function syncRange(User $user, string $from, string $to): void
    {
        $this->pruneInactivePlanned($user, $from, $to);

        $routines = Routine::query()
            ->with('days')
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->get();

        if ($routines->isEmpty()) {
            return;
        }

        // Una sola consulta para saber qué (rutina, fecha) ya tienen sesión.
        $existing = WorkoutSession::query()
            ->where('user_id', $user->id)
            ->whereIn('routine_id', $routines->pluck('id')->all())
            ->whereDate('scheduled_date', '>=', $from)
            ->whereDate('scheduled_date', '<=', $to)
            ->get(['routine_id', 'scheduled_date'])
            ->mapWithKeys(fn (WorkoutSession $session) => [
                $session->routine_id.'|'.$session->scheduled_date->toDateString() => true,
            ])
            ->all();

        $now = now();
        $rows = [];

        foreach (CarbonPeriod::create($from, $to) as $date) {
            /** @var Carbon $date */
            $dateString = $date->toDateString();
            $isoWeekday = (int) $date->isoWeekday();

            foreach ($routines as $routine) {
                if (! $routine->isEffectiveOn($date) || isset($existing[$routine->id.'|'.$dateString])) {
                    continue;
                }

                $day = $routine->days->firstWhere('weekday', $isoWeekday);
                if ($day === null) {
                    continue;
                }

                $rows[] = [
                    'tenant_id' => $routine->tenant_id,
                    'user_id' => $user->id,
                    'routine_id' => $routine->id,
                    'routine_day_id' => $day->id,
                    'scheduled_date' => $dateString,
                    'is_planned' => true,
                    'was_swapped' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // insertOrIgnore: si dos peticiones planifican a la vez, el índice único evita duplicados.
        foreach (array_chunk($rows, 500) as $chunk) {
            WorkoutSession::query()->insertOrIgnore($chunk);
        }
    }

    /**
     * Tras editar los días de una rutina: borra sesiones futuras que nadie ha tocado
     * (sin series, sin completar, sin empezar) para que se vuelvan a planificar.
     */
    public function resetFutureSessions(Routine $routine): void
    {
        WorkoutSession::query()
            ->where('routine_id', $routine->id)
            ->where('user_id', $routine->user_id)
            ->whereDate('scheduled_date', '>=', now()->toDateString())
            ->whereNull('completed_at')
            ->whereNull('started_at')
            ->whereDoesntHave('setLogs')
            ->delete();
    }

    /**
     * Borra sesiones vacías (sin completar ni series) de rutinas pausadas o fuera de fechas.
     * Incluye futuras y las del rango visible desde hoy.
     */
    private function pruneInactivePlanned(User $user, string $from, string $to): void
    {
        $today = now()->toDateString();
        $pruneFrom = max($from, $today);

        WorkoutSession::query()
            ->where('user_id', $user->id)
            ->whereNull('completed_at')
            ->whereDoesntHave('setLogs')
            ->whereDate('scheduled_date', '>=', $pruneFrom)
            ->whereDate('scheduled_date', '<=', max($to, $pruneFrom))
            ->where(function ($query) {
                $query->whereHas('routine', fn ($q) => $q->where('is_active', false))
                    ->orWhereHas('routine', function ($q) {
                        $q->whereNotNull('ends_on')
                            ->whereColumn('workout_sessions.scheduled_date', '>', 'routines.ends_on');
                    })
                    ->orWhereHas('routine', function ($q) {
                        $q->whereNotNull('starts_on')
                            ->whereColumn('workout_sessions.scheduled_date', '<', 'routines.starts_on');
                    });
            })
            ->delete();
    }
}
