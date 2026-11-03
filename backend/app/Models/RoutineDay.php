<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoutineDay extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'routine_id',
        'day_index',
        'weekday',
        'name',
        'focus',
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

    /**
     * Ejercicios visibles del día (sin los archivados).
     */
    public function exercises(): HasMany
    {
        return $this->hasMany(RoutineExercise::class)->whereNull('routine_exercises.archived_at')->orderBy('sort_order');
    }

    /**
     * Todos los ejercicios del día, incluidos los archivados.
     */
    public function allExercises(): HasMany
    {
        return $this->hasMany(RoutineExercise::class)->orderBy('sort_order');
    }

    public function workoutSessions(): HasMany
    {
        return $this->hasMany(WorkoutSession::class);
    }
}
