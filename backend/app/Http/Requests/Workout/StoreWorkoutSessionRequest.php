<?php

namespace App\Http\Requests\Workout;

use Illuminate\Foundation\Http\FormRequest;

class StoreWorkoutSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'routine_id' => ['required', 'integer', 'exists:routines,id'],
            'routine_day_id' => ['required', 'integer', 'exists:routine_days,id'],
            'scheduled_date' => ['required', 'date'],
        ];
    }
}
