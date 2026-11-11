<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

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

    /**
     * Momento real de entrenamiento: cuándo se empezó (o terminó) de verdad y,
     * si nunca se abrió, la fecha planificada. Una sesión del jueves hecha el
     * martes cuenta como del martes.
     */
    public static function trainedAtSql(string $table = 'workout_sessions'): string
    {
        return "COALESCE({$table}.started_at, {$table}.completed_at, {$table}.scheduled_date)";
    }

    /**
     * Igual que trainedAtSql() pero solo la fecha (Y-m-d), válido en MariaDB y SQLite.
     */
    public static function trainedOnSql(string $table = 'workout_sessions'): string
    {
        return 'DATE('.static::trainedAtSql($table).')';
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

    /** Ejercicios cambiados o añadidos solo para esta sesión. */
    public function extraExercises(): HasMany
    {
        return $this->hasMany(RoutineExercise::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * Lo que toca hoy: los ejercicios del día con los cambios de esta sesión aplicados
     * (cada sustituto ocupa el sitio del original) y los añadidos al final.
     *
     * @return Collection<int, RoutineExercise>
     */
    public function exercisesForToday(): Collection
    {
        $this->loadMissing(['day.exercises', 'extraExercises']);

        $planned = $this->day?->exercises ?? collect();
        $extras = $this->extraExercises;
        $replacements = $extras->whereNotNull('replaces_routine_exercise_id')->keyBy('replaces_routine_exercise_id');

        $today = $planned->map(fn (RoutineExercise $exercise) => $replacements->get($exercise->id) ?? $exercise);
        $placed = $today->pluck('id')->all();

        return $today
            ->concat($extras->reject(fn (RoutineExercise $extra) => in_array($extra->id, $placed, true)))
            ->values();
    }

    public function setLogs(): HasMany
    {
        return $this->hasMany(ExerciseSetLog::class);
    }
}
