<?php

namespace App\Http\Requests\Workout;

use Illuminate\Foundation\Http\FormRequest;

class SyncWorkoutLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'complete' => ['sometimes', 'boolean'],
            'sets' => ['required', 'array', 'min:1'],
            'sets.*.routine_exercise_id' => ['required', 'integer', 'exists:routine_exercises,id'],
            'sets.*.set_number' => ['required', 'integer', 'min:1', 'max:20'],
            'sets.*.weight_kg' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'sets.*.reps' => ['nullable', 'integer', 'min:0', 'max:100'],
            'sets.*.duration_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
            'sets.*.completed' => ['sometimes', 'boolean'],
        ];
    }
}
