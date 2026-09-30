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
        'name',
        'sort_order',
        'default_sets',
        'default_reps',
        'rest_seconds',
        'target_muscle',
        'notes',
    ];

    public function routine(): BelongsTo
    {
        return $this->belongsTo(Routine::class);
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(RoutineDay::class, 'routine_day_id');
    }

    public function setLogs(): HasMany
    {
        return $this->hasMany(ExerciseSetLog::class);
    }
}
