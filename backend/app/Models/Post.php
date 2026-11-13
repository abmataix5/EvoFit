<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Entreno compartido en el feed.
 */
class Post extends Model
{
    public const PHOTO_DISK = 'local';

    protected $fillable = ['user_id', 'workout_session_id', 'caption', 'gym_name', 'summary', 'photo_path', 'edited_at'];

    protected function casts(): array
    {
        return ['summary' => 'array', 'edited_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::deleting(function (Post $post): void {
            $post->deletePhotoFile();
        });
    }

    public function workoutSession(): BelongsTo
    {
        return $this->belongsTo(WorkoutSession::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function likes(): HasMany
    {
        return $this->hasMany(PostLike::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }

    public function photoUrl(): ?string
    {
        if (! $this->photo_path) {
            return null;
        }

        // La versión cambia con la foto (no con cada "me gusta"): la caché del navegador dura.
        return \App\Support\MediaUrl::to('media.post', ['post' => $this->id, 'v' => substr(md5($this->photo_path), 0, 10)]);
    }

    public function deletePhotoFile(): void
    {
        if ($this->photo_path) {
            Storage::disk(self::PHOTO_DISK)->delete($this->photo_path);
        }
    }
}
