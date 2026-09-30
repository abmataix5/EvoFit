<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ProgressPhoto */
class ProgressPhotoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'recorded_on' => $this->recorded_on?->toDateString(),
            'caption' => $this->caption,
            'url' => $this->url(),
        ];
    }
}
