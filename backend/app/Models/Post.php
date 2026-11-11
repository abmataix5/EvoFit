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

    protected $fillable = ['user_id', 'workout_session_id', 'caption', 'gym_name', 'summary', 'photo_path'];

    protected function casts(): array
    {
        return ['summary' => 'array'];
    }

    protected static function booted(): void
    {
        static::deleting(function (Post $post): void {
            $post->deletePhotoFile();
        });
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

        return '/api/v1/posts/'.$this->id.'/photo?v='.$this->updated_at?->getTimestamp();
    }

    public function deletePhotoFile(): void
    {
        if ($this->photo_path) {
            Storage::disk(self::PHOTO_DISK)->delete($this->photo_path);
        }
    }
}
