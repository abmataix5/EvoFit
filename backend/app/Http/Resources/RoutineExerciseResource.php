<?php

namespace App\Http\Resources;

use App\Models\RoutineExercise;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin RoutineExercise */
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
            // Cambio o añadido solo para una sesión (no forma parte de la rutina).
            'session_only' => $this->workout_session_id !== null,
            'replaces_routine_exercise_id' => $this->replaces_routine_exercise_id,
            // Ejercicio de la biblioteca (si su catálogo está enlazado): fotos y técnica.
            'library_slug' => $this->whenLoaded('catalogExercise', fn () => $this->catalogExercise?->exercise?->slug),
            'image_urls' => $this->whenLoaded('catalogExercise', fn () => $this->catalogExercise?->exercise?->imageUrls()),
        ];
    }
}
