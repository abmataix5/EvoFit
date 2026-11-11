<?php

namespace App\Services;

use App\Models\User;
use App\Services\Images\JpegEncoder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Guarda la foto de perfil como un JPEG cuadrado y re-codificado.
 *
 * Re-codificar con GD elimina los metadatos (EXIF, GPS del móvil) y cualquier
 * contenido que no sea imagen, y deja un tamaño fijo y ligero para listas y feed.
 */
class AvatarProcessor
{
    public const SIZE = 512;

    private const QUALITY = 85;

    public function __construct(private readonly JpegEncoder $encoder) {}

    public function replace(User $user, UploadedFile $file): User
    {
        $jpeg = $this->encoder->encode($file, self::SIZE, square: true, quality: self::QUALITY, field: 'avatar');
        $path = 'avatars/'.$user->id.'/'.Str::uuid()->toString().'.jpg';
        $disk = Storage::disk(User::AVATAR_DISK);
        $disk->put($path, $jpeg);

        $previous = $user->avatar_path;

        try {
            DB::transaction(function () use ($user, $path) {
                $user->forceFill(['avatar_path' => $path, 'avatar_updated_at' => now()])->save();
            });
        } catch (\Throwable $e) {
            $disk->delete($path);
            throw $e;
        }

        if ($previous && $previous !== $path) {
            $disk->delete($previous);
        }

        return $user;
    }

    public function remove(User $user): User
    {
        $user->deleteAvatarFile();
        $user->forceFill(['avatar_path' => null, 'avatar_updated_at' => now()])->save();

        return $user;
    }
}
