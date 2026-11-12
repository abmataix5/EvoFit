<?php

namespace App\Http\Requests\Workout;

use App\Models\RoutineExercise;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SyncWorkoutLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('workoutSession'));
    }

    public function rules(): array
    {
        return [
            'complete' => ['sometimes', 'boolean'],
            // Día que marca el móvil de quien entrena (las horas del servidor van en UTC).
            'local_date' => ['nullable', 'date_format:Y-m-d'],
            'sets' => ['sometimes', 'array'],
            'sets.*.routine_exercise_id' => ['required', 'integer'],
            'sets.*.set_number' => ['required', 'integer', 'min:1', 'max:20'],
            'sets.*.weight_kg' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'sets.*.reps' => ['nullable', 'integer', 'min:0', 'max:100'],
            'sets.*.duration_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
            'sets.*.rpe' => ['nullable', 'numeric', 'min:1', 'max:10'],
            'sets.*.notes' => ['nullable', 'string', 'max:255'],
            'sets.*.completed' => ['sometimes', 'boolean'],
            'remove_sets' => ['sometimes', 'array'],
            'remove_sets.*.routine_exercise_id' => ['required', 'integer'],
            'remove_sets.*.set_number' => ['required', 'integer', 'min:1', 'max:20'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var WorkoutSession $session */
            $session = $this->route('workoutSession');

            // Ejercicios del día de esta sesión (incluidos los archivados, que conservan sus series)
            // y los cambiados o añadidos solo para esta sesión.
            $allowed = RoutineExercise::query()
                ->where(function ($query) use ($session) {
                    $query->where('workout_session_id', $session->id);
                    if ($session->routine_day_id !== null) {
                        $query->orWhere(fn ($q) => $q
                            ->where('routine_day_id', $session->routine_day_id)
                            ->whereNull('workout_session_id'));
                    }
                })
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            foreach (['sets', 'remove_sets'] as $key) {
                foreach ((array) $this->input($key, []) as $i => $item) {
                    $id = $item['routine_exercise_id'] ?? null;
                    if ($id !== null && is_numeric($id) && ! in_array((int) $id, $allowed, true)) {
                        $validator->errors()->add("$key.$i.routine_exercise_id", 'Ese ejercicio no pertenece al día de esta sesión.');
                    }
                }
            }
        });
    }
}
