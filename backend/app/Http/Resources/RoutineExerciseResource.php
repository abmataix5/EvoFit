<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\RoutineExercise */
class RoutineExerciseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'routine_day_id' => $this->routine_day_id,
            'catalog_exercise_id' => $this->catalog_exercise_id,
            'name' => $this->name,
            'sort_order' => $this->sort_order,
            'tracking_mode' => $this->tracking_mode ?? 'weight_reps',
            'time_direction' => $this->time_direction ?? 'faster',
            'default_sets' => $this->default_sets,
            'default_reps' => $this->default_reps,
            'default_duration_seconds' => $this->default_duration_seconds,
            'rest_seconds' => $this->rest_seconds,
            'target_muscle' => $this->target_muscle,
            'notes' => $this->notes,
        ];
    }
}
