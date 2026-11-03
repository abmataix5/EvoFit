<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Routine extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'name',
        'description',
        'sessions_per_week',
        'is_active',
        'starts_on',
        'ends_on',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Días visibles de la rutina (sin los archivados).
     */
    public function days(): HasMany
    {
        return $this->hasMany(RoutineDay::class)->whereNull('routine_days.archived_at')->orderBy('day_index');
    }

    /**
     * Todos los días, incluidos los archivados (conservan historial).
     */
    public function allDays(): HasMany
    {
        return $this->hasMany(RoutineDay::class)->orderBy('day_index');
    }

    /**
     * Ejercicios visibles de la rutina (sin los archivados ni los de días archivados).
     */
    public function exercises(): HasMany
    {
        return $this->hasMany(RoutineExercise::class)
            ->whereNull('routine_exercises.archived_at')
            ->whereHas('day', fn ($query) => $query->whereNull('routine_days.archived_at'))
            ->orderBy('sort_order');
    }

    public function allExercises(): HasMany
    {
        return $this->hasMany(RoutineExercise::class)->orderBy('sort_order');
    }

    public function workoutSessions(): HasMany
    {
        return $this->hasMany(WorkoutSession::class);
    }

    public function isEffectiveOn(CarbonInterface $date): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->starts_on !== null && $date->lt($this->starts_on->startOfDay())) {
            return false;
        }

        if ($this->ends_on !== null && $date->gt($this->ends_on->endOfDay())) {
            return false;
        }

        return true;
    }
}
