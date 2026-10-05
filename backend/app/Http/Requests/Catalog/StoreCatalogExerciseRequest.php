<?php

namespace App\Http\Requests\Catalog;

use App\Models\CatalogExercise;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreCatalogExerciseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'target_muscle' => ['nullable', 'string', 'max:80'],
            'tracking_mode' => ['nullable', 'string', 'in:weight_reps,time,weight_time'],
            'time_direction' => ['nullable', 'string', 'in:faster,longer'],
            'default_sets' => ['nullable', 'integer', 'min:1', 'max:20'],
            'default_reps' => ['nullable', 'integer', 'min:1', 'max:100'],
            'default_duration_seconds' => ['nullable', 'integer', 'min:1', 'max:7200'],
            'rest_seconds' => ['nullable', 'integer', 'min:0', 'max:600'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $name = trim((string) $this->input('name', ''));
            if ($name === '') {
                return;
            }

            $exists = CatalogExercise::query()
                ->where('user_id', $this->user()->id)
                ->where('name_key', mb_strtolower($name))
                ->exists();

            if ($exists) {
                $validator->errors()->add('name', 'Ya tienes un ejercicio con ese nombre en tu catálogo.');
            }
        });
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->input('name'))]);
        }
    }
}
