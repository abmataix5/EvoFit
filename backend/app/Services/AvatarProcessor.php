<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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

    public function replace(User $user, UploadedFile $file): User
    {
        $jpeg = $this->squareJpeg($file);
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

    private function squareJpeg(UploadedFile $file): string
    {
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if ($source === false) {
            throw ValidationException::withMessages(['avatar' => 'No se ha podido leer la imagen.']);
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);
        $target = min(self::SIZE, $side);

        $canvas = imagecreatetruecolor($target, $target);
        // Fondo blanco por si el PNG/WebP trae transparencia (JPEG no la admite).
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled(
            $canvas, $source,
            0, 0,
            intdiv($width - $side, 2), intdiv($height - $side, 2),
            $target, $target,
            $side, $side,
        );

        ob_start();
        imagejpeg($canvas, null, self::QUALITY);
        $jpeg = (string) ob_get_clean();

        imagedestroy($source);
        imagedestroy($canvas);

        return $jpeg;
    }
}
