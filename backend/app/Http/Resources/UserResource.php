<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * El usuario autenticado tal y como se ve a sí mismo (incluye datos privados:
 * email, fecha de nacimiento y ajustes de privacidad).
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'username' => $this->username,
            'avatar_url' => $this->avatarUrl(),
            'bio' => $this->bio,
            'location' => $this->location,
            'birth_date' => $this->birth_date?->toDateString(),
            'age' => $this->age(),
            'height_cm' => $this->height_cm,
            'gym_name' => $this->gym_name,
            'experience_level' => $this->experience_level?->value,
            'training_goal' => $this->training_goal?->value,
            'profile_visibility' => $this->profile_visibility?->value,
            'show_age' => (bool) $this->show_age,
            'email_notifications' => (bool) $this->email_notifications,
            'member_since' => $this->created_at?->toDateString(),
            'tenant' => $this->whenLoaded('tenant', fn () => [
                'id' => $this->tenant->id,
                'name' => $this->tenant->name,
                'slug' => $this->tenant->slug,
                'plan' => $this->tenant->plan,
            ]),
        ];
    }
}
