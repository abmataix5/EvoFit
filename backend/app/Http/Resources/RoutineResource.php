<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Routine */
class RoutineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'sessions_per_week' => $this->sessions_per_week,
            'is_active' => $this->is_active,
            'starts_on' => $this->starts_on?->toDateString(),
            'ends_on' => $this->ends_on?->toDateString(),
            'days' => RoutineDayResource::collection($this->whenLoaded('days')),
            'days_count' => $this->relationLoaded('days')
                ? $this->days->count()
                : $this->days()->count(),
            'exercises_count' => $this->relationLoaded('days')
                ? $this->days->sum(fn ($day) => $day->relationLoaded('exercises')
                    ? $day->exercises->count()
                    : $day->exercises()->count())
                : $this->exercises()->count(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
