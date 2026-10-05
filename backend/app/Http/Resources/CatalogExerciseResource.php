<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\CatalogExercise */
class CatalogExerciseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'target_muscle' => $this->target_muscle,
            'tracking_mode' => $this->tracking_mode ?? 'weight_reps',
            'time_direction' => $this->time_direction ?? 'faster',
            'default_sets' => $this->default_sets,
            'default_reps' => $this->default_reps,
            'default_duration_seconds' => $this->default_duration_seconds,
            'rest_seconds' => $this->rest_seconds,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
