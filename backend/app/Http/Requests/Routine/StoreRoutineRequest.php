<?php

namespace App\Http\Requests\Routine;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoutineRequest extends FormRequest
{
    use RoutineDaysRules;

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
            ...$this->dayRules('required'),
        ];
    }

    public function messages(): array
    {
        return $this->dayMessages();
    }
}
