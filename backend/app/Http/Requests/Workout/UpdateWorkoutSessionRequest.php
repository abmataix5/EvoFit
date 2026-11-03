<?php

namespace App\Http\Requests\Workout;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWorkoutSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('workoutSession'));
    }

    public function rules(): array
    {
        return [
            'routine_day_id' => ['sometimes', 'required', 'integer'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }
}
