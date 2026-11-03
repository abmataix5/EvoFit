<?php

namespace App\Http\Requests\Routine;

use App\Models\Routine;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateRoutineRequest extends FormRequest
{
    use RoutineDaysRules;

    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('routine'));
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sessions_per_week' => ['sometimes', 'integer', 'min:1', 'max:7'],
            'is_active' => ['sometimes', 'boolean'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            ...$this->dayRules('sometimes'),
        ];
    }

    public function messages(): array
    {
        return $this->dayMessages();
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! is_array($this->input('days'))) {
                return;
            }

            /** @var Routine $routine */
            $routine = $this->route('routine');
            $dayIds = $routine->days()->pluck('id')->map(fn ($id) => (int) $id)->all();
            $exerciseIds = $routine->allExercises()->whereNull('archived_at')->pluck('id')->map(fn ($id) => (int) $id)->all();
            $seenExercises = [];

            foreach ($this->input('days') as $i => $day) {
                if (isset($day['id']) && ! in_array((int) $day['id'], $dayIds, true)) {
                    $validator->errors()->add("days.$i.id", 'Ese día no pertenece a esta rutina.');
                }

                foreach ($day['exercises'] ?? [] as $j => $exercise) {
                    if (! isset($exercise['id'])) {
                        continue;
                    }
                    $id = (int) $exercise['id'];
                    if (! in_array($id, $exerciseIds, true)) {
                        $validator->errors()->add("days.$i.exercises.$j.id", 'Ese ejercicio no pertenece a esta rutina.');
                    } elseif (isset($seenExercises[$id])) {
                        $validator->errors()->add("days.$i.exercises.$j.id", 'Ese ejercicio está repetido.');
                    }
                    $seenExercises[$id] = true;
                }
            }
        });
    }
}
