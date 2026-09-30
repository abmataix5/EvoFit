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
            'name' => $this->name,
            'sort_order' => $this->sort_order,
            'default_sets' => $this->default_sets,
            'default_reps' => $this->default_reps,
            'rest_seconds' => $this->rest_seconds,
            'target_muscle' => $this->target_muscle,
            'notes' => $this->notes,
        ];
    }
}
