<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkoutSession extends Model
{
    use BelongsToTenant;

    /** @var array<int, array<string, mixed>>|null */
    public ?array $previousLifts = null;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'routine_id',
        'routine_day_id',
        'scheduled_date',
        'started_at',
        'completed_at',
        'notes',
        'is_planned',
        'was_swapped',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'is_planned' => 'boolean',
            'was_swapped' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

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
