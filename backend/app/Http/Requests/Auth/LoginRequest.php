<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            // Solo lo mandan las apps de iOS y Android: reciben un token en vez de una cookie.
            'device_name' => ['nullable', 'string', 'max:100'],
        ];
    }
}
