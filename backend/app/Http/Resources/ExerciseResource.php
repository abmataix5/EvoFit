<?php

namespace App\Http\Resources;

use App\Models\Exercise;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Exercise */
class ExerciseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'aliases' => $this->aliases,
            'muscle' => $this->muscle,
            'muscle_label' => $this->muscleLabel(),
            'secondary_muscles' => $this->secondary_muscles,
            'equipment' => $this->equipment,
            'mechanic' => $this->mechanic,
            'tracking_mode' => $this->tracking_mode,
            'time_direction' => $this->time_direction,
            'default_sets' => $this->default_sets,
            'default_reps' => $this->default_reps,
            'default_duration_seconds' => $this->default_duration_seconds,
            'rest_seconds' => $this->rest_seconds,
            'cues' => $this->cues,
            'image_urls' => $this->imageUrls(),
        ];
    }
}
