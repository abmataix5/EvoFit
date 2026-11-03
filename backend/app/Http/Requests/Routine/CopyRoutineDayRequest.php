<?php

namespace App\Http\Requests\Routine;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CopyRoutineDayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('routine'));
    }

    public function rules(): array
    {
        return [
            'target_day_ids' => ['required', 'array', 'min:1'],
            'target_day_ids.*' => [
                'integer',
                Rule::exists('routine_days', 'id')
                    ->where('routine_id', $this->route('routine')->id)
                    ->whereNull('archived_at'),
            ],
            'replace' => ['sometimes', 'boolean'],
        ];
    }
}
