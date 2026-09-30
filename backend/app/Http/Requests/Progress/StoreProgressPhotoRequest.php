<?php

namespace App\Http\Requests\Progress;

use Illuminate\Foundation\Http\FormRequest;

class StoreProgressPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'recorded_on' => ['required', 'date'],
            'caption' => ['nullable', 'string', 'max:200'],
            'photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
        ];
    }

    public function messages(): array
    {
        return [
            'photo.required' => 'Selecciona una foto.',
            'photo.mimes' => 'La foto tiene que ser JPG, PNG o WebP.',
            'photo.max' => 'La foto pesa demasiado (máximo 12 MB).',
        ];
    }
}
