<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoutineExercise extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'routine_id',
        'routine_day_id',
        'workout_session_id',
        'replaces_routine_exercise_id',
        'catalog_exercise_id',
        'name',
        'sort_order',
        'default_sets',
        'default_reps',
        'rest_seconds',
        'target_muscle',
        'tracking_mode',
        'time_direction',
        'default_duration_seconds',
        'notes',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
        ];
    }

    public function routine(): BelongsTo
    {
        return $this->belongsTo(Routine::class);
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(RoutineDay::class, 'routine_day_id');
    }

    public function catalogExercise(): BelongsTo
    {
        return $this->belongsTo(CatalogExercise::class, 'catalog_exercise_id');
    }

    /** Sesión a la que pertenece si es un ejercicio "solo para hoy" (null = de la rutina). */
    public function workoutSession(): BelongsTo
    {
        return $this->belongsTo(WorkoutSession::class);
    }

    public function replaces(): BelongsTo
    {
        return $this->belongsTo(self::class, 'replaces_routine_exercise_id');
    }

    public function isSessionOnly(): bool
    {
        return $this->workout_session_id !== null;
    }

    public function setLogs(): HasMany
    {
        return $this->hasMany(ExerciseSetLog::class);
    }
}
