<?php

namespace App\Services;

use App\Models\Routine;
use App\Models\WorkoutSession;
use App\Models\User;
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

        $period = CarbonPeriod::create($from, $to);

        foreach ($period as $date) {
            /** @var Carbon $date */
            $dateString = $date->toDateString();
            $isoWeekday = (int) $date->isoWeekday();

            foreach ($routines as $routine) {
                if (! $routine->isEffectiveOn($date)) {
                    continue;
                }

                $alreadyHasSession = WorkoutSession::query()
                    ->where('user_id', $user->id)
                    ->where('routine_id', $routine->id)
                    ->whereDate('scheduled_date', $dateString)
                    ->exists();

                if ($alreadyHasSession) {
                    continue;
                }

                $day = $routine->days->firstWhere('weekday', $isoWeekday);
                if ($day === null) {
                    continue;
                }

                WorkoutSession::query()->create([
                    'user_id' => $user->id,
                    'routine_id' => $routine->id,
                    'routine_day_id' => $day->id,
                    'scheduled_date' => $dateString,
                    'is_planned' => true,
                    'was_swapped' => false,
                ]);
            }
        }
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
