<?php

namespace App\Http\Resources;

use App\Models\Routine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Routine */
class RoutineResource extends JsonResource
{
    /** Días con sus ejercicios y, de cada uno, el de la biblioteca (para fotos y técnica). */
    public const DETAIL_RELATIONS = ['days.exercises.catalogExercise.exercise'];

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
            // Los contadores salen de relaciones precargadas o de withCount():
            // nunca lanzan una consulta por cada rutina serializada.
            'days_count' => $this->when(
                $this->relationLoaded('days') || $this->resource->getAttribute('days_count') !== null,
                fn () => $this->relationLoaded('days')
                    ? $this->days->count()
                    : (int) $this->resource->getAttribute('days_count')
            ),
            'exercises_count' => $this->when(
                $this->exercisesLoaded() || $this->resource->getAttribute('exercises_count') !== null,
                fn () => $this->exercisesLoaded()
                    ? $this->days->sum(fn ($day) => $day->exercises->count())
                    : (int) $this->resource->getAttribute('exercises_count')
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function exercisesLoaded(): bool
    {
        return $this->relationLoaded('days')
            && $this->days->every(fn ($day) => $day->relationLoaded('exercises'));
    }
}
