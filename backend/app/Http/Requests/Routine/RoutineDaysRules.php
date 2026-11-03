<?php

namespace App\Http\Requests\Routine;

/**
 * Reglas compartidas para los días/ejercicios de una rutina (crear y editar).
 */
trait RoutineDaysRules
{
    /**
     * @return array<string, array<int, string>>
     */
    protected function dayRules(string $presence): array
    {
        return [
            'days' => [$presence, 'array', 'min:1', 'max:7'],
            'days.*.id' => ['nullable', 'integer'],
            'days.*.day_index' => ['required', 'integer', 'min:1', 'max:7', 'distinct'],
            'days.*.weekday' => ['required', 'integer', 'min:1', 'max:7', 'distinct'],
            'days.*.name' => ['required', 'string', 'max:80'],
            'days.*.focus' => ['nullable', 'string', 'max:40'],
            'days.*.notes' => ['nullable', 'string', 'max:500'],
            'days.*.exercises' => ['nullable', 'array'],
            'days.*.exercises.*.id' => ['nullable', 'integer'],
            'days.*.exercises.*.catalog_exercise_id' => ['nullable', 'integer', 'exists:catalog_exercises,id'],
            'days.*.exercises.*.name' => ['required_without:days.*.exercises.*.catalog_exercise_id', 'nullable', 'string', 'max:160'],
            'days.*.exercises.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'days.*.exercises.*.tracking_mode' => ['nullable', 'string', 'in:weight_reps,time,weight_time'],
            'days.*.exercises.*.time_direction' => ['nullable', 'string', 'in:faster,longer'],
            'days.*.exercises.*.default_sets' => ['nullable', 'integer', 'min:1', 'max:20'],
            'days.*.exercises.*.default_reps' => ['nullable', 'integer', 'min:1', 'max:100'],
            'days.*.exercises.*.default_duration_seconds' => ['nullable', 'integer', 'min:1', 'max:7200'],
            'days.*.exercises.*.rest_seconds' => ['nullable', 'integer', 'min:0', 'max:600'],
            'days.*.exercises.*.target_muscle' => ['nullable', 'string', 'max:80'],
            'days.*.exercises.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function dayMessages(): array
    {
        return [
            'days.*.weekday.distinct' => 'Cada día de la semana solo puede asignarse una vez.',
            'days.*.day_index.distinct' => 'Hay dos días con el mismo número.',
        ];
    }
}
