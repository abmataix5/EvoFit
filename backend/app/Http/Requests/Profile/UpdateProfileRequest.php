<?php

namespace App\Http\Requests\Profile;

use App\Enums\ExperienceLevel;
use App\Enums\ProfileVisibility;
use App\Enums\TrainingGoal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $trim = fn ($value) => is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;

        $data = [];
        foreach (['name', 'bio', 'location', 'gym_name', 'birth_date', 'height_cm', 'experience_level', 'training_goal'] as $field) {
            if ($this->has($field)) {
                $data[$field] = $trim($this->input($field));
            }
        }
        if ($this->has('username')) {
            $username = $trim($this->input('username'));
            $data['username'] = is_string($username) ? mb_strtolower(ltrim($username, '@')) : $username;
        }

        $this->merge($data);
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'username' => [
                'sometimes', 'nullable', 'string', 'min:3', 'max:30',
                'regex:/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/',
                Rule::unique('users', 'username')->ignore($this->user()->id),
            ],
            'bio' => ['sometimes', 'nullable', 'string', 'max:280'],
            'location' => ['sometimes', 'nullable', 'string', 'max:80'],
            'birth_date' => ['sometimes', 'nullable', 'date', 'before_or_equal:'.now()->subYears(13)->toDateString(), 'after:1900-01-01'],
            'height_cm' => ['sometimes', 'nullable', 'integer', 'between:100,250'],
            'gym_name' => ['sometimes', 'nullable', 'string', 'max:80'],
            'experience_level' => ['sometimes', 'nullable', Rule::enum(ExperienceLevel::class)],
            'training_goal' => ['sometimes', 'nullable', Rule::enum(TrainingGoal::class)],
            'profile_visibility' => ['sometimes', 'required', Rule::enum(ProfileVisibility::class)],
            'show_age' => ['sometimes', 'required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Tu nombre no puede quedar vacío.',
            'username.min' => 'El usuario necesita al menos 3 caracteres.',
            'username.max' => 'El usuario puede tener como mucho 30 caracteres.',
            'username.regex' => 'Usa solo letras minúsculas, números, puntos y guiones bajos (sin empezar ni acabar en símbolo).',
            'username.unique' => 'Ese nombre de usuario ya está cogido.',
            'bio.max' => 'La bio puede tener como mucho 280 caracteres.',
            'birth_date.before_or_equal' => 'Tienes que tener al menos 13 años.',
            'birth_date.after' => 'Revisa la fecha de nacimiento.',
            'height_cm.between' => 'La altura tiene que estar entre 100 y 250 cm.',
        ];
    }
}
