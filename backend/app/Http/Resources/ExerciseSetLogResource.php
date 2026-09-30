<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ExerciseSetLog */
class ExerciseSetLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'routine_exercise_id' => $this->routine_exercise_id,
            'set_number' => $this->set_number,
            'weight_kg' => $this->weight_kg,
            'reps' => $this->reps,
            'completed' => $this->completed,
            'exercise' => new RoutineExerciseResource($this->whenLoaded('routineExercise')),
        ];
    }
}
