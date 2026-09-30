<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExerciseSetLog extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'workout_session_id',
        'routine_exercise_id',
        'set_number',
        'weight_kg',
        'reps',
        'completed',
    ];

    protected function casts(): array
    {
        return [
            'weight_kg' => 'decimal:2',
            'completed' => 'boolean',
        ];
    }

    public function workoutSession(): BelongsTo
    {
        return $this->belongsTo(WorkoutSession::class);
    }

    public function routineExercise(): BelongsTo
    {
        return $this->belongsTo(RoutineExercise::class);
    }
}
