<?php

namespace App\Http\Requests\Routine;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoutineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sessions_per_week' => ['required', 'integer', 'min:1', 'max:7'],
            'is_active' => ['sometimes', 'boolean'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'days' => ['required', 'array', 'min:1', 'max:7'],
            'days.*.day_index' => ['required', 'integer', 'min:1', 'max:7'],
            'days.*.weekday' => ['required', 'integer', 'min:1', 'max:7'],
            'days.*.name' => ['required', 'string', 'max:80'],
            'days.*.focus' => ['nullable', 'string', 'max:40'],
            'days.*.notes' => ['nullable', 'string', 'max:500'],
            'days.*.exercises' => ['nullable', 'array'],
            'days.*.exercises.*.name' => ['required_with:days.*.exercises', 'string', 'max:160'],
            'days.*.exercises.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'days.*.exercises.*.default_sets' => ['nullable', 'integer', 'min:1', 'max:20'],
            'days.*.exercises.*.default_reps' => ['nullable', 'integer', 'min:1', 'max:100'],
            'days.*.exercises.*.rest_seconds' => ['nullable', 'integer', 'min:0', 'max:600'],
            'days.*.exercises.*.target_muscle' => ['nullable', 'string', 'max:80'],
            'days.*.exercises.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
