<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Historia de 24 horas.
 */
class Story extends Model
{
    public const PHOTO_DISK = 'local';

    public const LIFETIME_HOURS = 24;

    public const BACKGROUNDS = ['energy', 'lime', 'night', 'fire'];

    protected $fillable = ['user_id', 'photo_path', 'background', 'text', 'stickers', 'expires_at'];

    protected function casts(): array
    {
        return ['stickers' => 'array', 'expires_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::deleting(function (Story $story): void {
            if ($story->photo_path) {
                Storage::disk(self::PHOTO_DISK)->delete($story->photo_path);
            }
        });
    }

    /** @param  Builder<Story>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('expires_at', '>', now());
    }

    public function isActive(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isFuture();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function views(): HasMany
    {
        return $this->hasMany(StoryView::class);
    }

    public function photoUrl(): ?string
    {
        return $this->photo_path ? \App\Support\MediaUrl::to('media.story', ['story' => $this->id]) : null;
    }
}
