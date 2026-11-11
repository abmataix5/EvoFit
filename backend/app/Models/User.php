<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\ExperienceLevel;
use App\Enums\ProfileVisibility;
use App\Enums\TrainingGoal;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'tenant_id', 'name', 'email', 'password', 'role',
    'username', 'bio', 'location', 'birth_date', 'height_cm', 'gym_name',
    'experience_level', 'training_goal', 'profile_visibility', 'show_age', 'email_notifications',
])]
#[Hidden(['password', 'remember_token', 'avatar_path'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /** Disco privado donde viven las fotos de perfil. */
    public const AVATAR_DISK = 'local';

    protected static function booted(): void
    {
        static::deleting(function (User $user): void {
            $user->deleteAvatarFile();
        });
    }

    /**
     * Reglas del alias: 3-30 caracteres en minúscula, números, puntos y guiones bajos,
     * sin empezar ni acabar en símbolo, y único.
     *
     * @return list<mixed>
     */
    public static function usernameRules(?int $ignoreId = null): array
    {
        return [
            'string', 'min:3', 'max:30',
            'regex:/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/',
            Rule::unique('users', 'username')->ignore($ignoreId),
        ];
    }

    /** @return array<string, string> */
    public static function usernameMessages(): array
    {
        return [
            'username.required' => 'Elige un nombre de usuario.',
            'username.min' => 'El usuario necesita al menos 3 caracteres.',
            'username.max' => 'El usuario puede tener como mucho 30 caracteres.',
            'username.regex' => 'Usa solo letras minúsculas, números, puntos y guiones bajos (sin empezar ni acabar en símbolo).',
            'username.unique' => 'Ese nombre de usuario ya está cogido.',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function age(): ?int
    {
        return $this->birth_date?->age;
    }

    public function avatarUrl(): ?string
    {
        if (! $this->avatar_path) {
            return null;
        }

        // La versión en la URL permite cachear la imagen y renovarla al cambiarla.
        return '/api/v1/users/'.$this->id.'/avatar?v='.($this->avatar_updated_at?->getTimestamp() ?? 0);
    }

    public function deleteAvatarFile(): void
    {
        if ($this->avatar_path) {
            Storage::disk(self::AVATAR_DISK)->delete($this->avatar_path);
        }
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'birth_date' => 'date',
            'height_cm' => 'integer',
            'show_age' => 'boolean',
            'email_notifications' => 'boolean',
            'avatar_updated_at' => 'datetime',
            'experience_level' => ExperienceLevel::class,
            'training_goal' => TrainingGoal::class,
            'profile_visibility' => ProfileVisibility::class,
        ];
    }
}
