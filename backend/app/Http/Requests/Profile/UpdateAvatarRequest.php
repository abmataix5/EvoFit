<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'avatar' => [
                'required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:8192',
                'dimensions:min_width=64,min_height=64,max_width=8000,max_height=8000',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'avatar.required' => 'Selecciona una foto.',
            'avatar.mimes' => 'La foto tiene que ser JPG, PNG o WebP.',
            'avatar.max' => 'La foto pesa demasiado (máximo 8 MB).',
            'avatar.dimensions' => 'La foto es demasiado pequeña o demasiado grande.',
        ];
    }
}
