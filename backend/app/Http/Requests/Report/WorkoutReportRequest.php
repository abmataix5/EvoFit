<?php

namespace App\Http\Requests\Report;

use Illuminate\Foundation\Http\FormRequest;

class WorkoutReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from', 'before_or_equal:'.$this->maxTo()],
            'tz' => ['nullable', 'timezone:all'],
        ];
    }

    public function messages(): array
    {
        return [
            'to.before_or_equal' => 'El informe puede abarcar como máximo un año.',
            'to.after_or_equal' => 'La fecha final debe ser igual o posterior a la inicial.',
        ];
    }

    private function maxTo(): string
    {
        $from = $this->input('from');
        if (! is_string($from) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
            return '9999-12-31';
        }

        return date('Y-m-d', strtotime($from.' +366 days'));
    }
}
