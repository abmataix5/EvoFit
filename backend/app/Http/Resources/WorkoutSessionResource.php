<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\WorkoutSession */
class WorkoutSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'routine_id' => $this->routine_id,
            'routine_day_id' => $this->routine_day_id,
            'scheduled_date' => $this->scheduled_date?->toDateString(),
            'started_at' => $this->started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'notes' => $this->notes,
            'is_planned' => $this->is_planned,
            'was_swapped' => $this->was_swapped,
            'routine' => new RoutineResource($this->whenLoaded('routine')),
            'day' => new RoutineDayResource($this->whenLoaded('day')),
            'set_logs' => ExerciseSetLogResource::collection($this->whenLoaded('setLogs')),
        ];
    }
}
