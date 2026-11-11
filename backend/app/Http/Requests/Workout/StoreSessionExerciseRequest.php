<?php

namespace App\Http\Requests\Workout;

use Illuminate\Foundation\Http\FormRequest;

class StoreSessionExerciseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('workoutSession'));
    }

    public function rules(): array
    {
        return [
            // Del catálogo (lo normal) o por nombre: si no existe se crea en el catálogo.
            'catalog_exercise_id' => ['required_without:name', 'nullable', 'integer'],
            'name' => ['required_without:catalog_exercise_id', 'nullable', 'string', 'max:120'],
            'replaces_routine_exercise_id' => ['nullable', 'integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'catalog_exercise_id.required_without' => 'Elige un ejercicio.',
            'name.required_without' => 'Elige un ejercicio.',
        ];
    }
}
