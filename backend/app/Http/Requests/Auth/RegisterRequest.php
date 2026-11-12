<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'username' => ['required', ...User::usernameRules()],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'workspace_name' => ['nullable', 'string', 'max:160'],
            // Tener 16 años o más y aceptar las condiciones y la política de privacidad.
            'terms' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            ...User::usernameMessages(),
            'name.required' => 'Escribe tu nombre.',
            'email.required' => 'Escribe tu email.',
            'email.email' => 'Escribe un email válido.',
            'email.unique' => 'Ya hay una cuenta con ese email. Prueba a iniciar sesión.',
            'password.required' => 'Elige una contraseña.',
            'password.min' => 'La contraseña necesita al menos :min caracteres.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'terms.accepted' => 'Para crear la cuenta tienes que tener 16 años o más y aceptar las condiciones.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('username'))) {
            $this->merge(['username' => mb_strtolower(ltrim(trim($this->input('username')), '@'))]);
        }
    }
}
