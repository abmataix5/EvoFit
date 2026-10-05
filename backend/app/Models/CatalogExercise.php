<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CatalogExercise extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'name',
        'name_key',
        'target_muscle',
        'tracking_mode',
        'time_direction',
        'default_sets',
        'default_reps',
        'default_duration_seconds',
        'rest_seconds',
        'notes',
    ];

    protected static function booted(): void
    {
        static::saving(function (CatalogExercise $exercise): void {
            $exercise->name = trim((string) $exercise->name);
            $exercise->name_key = mb_strtolower($exercise->name);
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function routineExercises(): HasMany
    {
        return $this->hasMany(RoutineExercise::class, 'catalog_exercise_id');
    }
}
