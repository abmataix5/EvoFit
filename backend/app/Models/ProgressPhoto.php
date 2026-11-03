<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ProgressPhoto extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'recorded_on',
        'disk',
        'path',
        'caption',
    ];

    protected function casts(): array
    {
        return [
            'recorded_on' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (ProgressPhoto $photo): void {
            if ($photo->path) {
                Storage::disk($photo->disk ?: 'local')->delete($photo->path);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function url(): string
    {
        // Las fotos son privadas: se sirven a través de la API con sesión y dueño.
        return '/api/v1/progress/photos/'.$this->id.'/image';
    }
}
