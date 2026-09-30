<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\RoutineDay */
class RoutineDayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'day_index' => $this->day_index,
            'weekday' => $this->weekday,
            'name' => $this->name,
            'focus' => $this->focus,
            'notes' => $this->notes,
            'exercises' => RoutineExerciseResource::collection($this->whenLoaded('exercises')),
            'exercises_count' => $this->when(
                ! $this->relationLoaded('exercises'),
                fn () => $this->exercises()->count()
            ),
        ];
    }
}
