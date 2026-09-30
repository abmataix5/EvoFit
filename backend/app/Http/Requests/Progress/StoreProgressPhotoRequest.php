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
            'photo' => ['required', 'image', 'max:8192'],
        ];
    }
}
