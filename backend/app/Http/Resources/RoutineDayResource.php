<?php

namespace App\Http\Resources;

use App\Models\RoutineDay;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin RoutineDay */
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
            // Sin consultas extra: solo si viene precargado con withCount('exercises').
            'exercises_count' => $this->when(
                ! $this->relationLoaded('exercises') && $this->resource->getAttribute('exercises_count') !== null,
                fn () => (int) $this->resource->getAttribute('exercises_count')
            ),
        ];
    }
}
