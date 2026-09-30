<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\BodyWeightEntry */
class BodyWeightEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'recorded_on' => $this->recorded_on?->toDateString(),
            'weight_kg' => $this->weight_kg,
            'notes' => $this->notes,
        ];
    }
}
