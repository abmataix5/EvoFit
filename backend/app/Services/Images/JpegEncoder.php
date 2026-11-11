<?php

namespace App\Services\Images;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * Re-codifica una foto subida a JPEG con GD: tamaño acotado y sin metadatos
 * (EXIF, GPS del móvil) ni nada que no sea imagen.
 */
class JpegEncoder
{
    public function encode(UploadedFile $file, int $maxEdge, bool $square = false, int $quality = 82, string $field = 'photo'): string
    {
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if ($source === false) {
            throw ValidationException::withMessages([$field => 'No se ha podido leer la imagen.']);
        }

        $width = imagesx($source);
        $height = imagesy($source);

        if ($square) {
            $side = min($width, $height);
            [$srcX, $srcY, $srcW, $srcH] = [intdiv($width - $side, 2), intdiv($height - $side, 2), $side, $side];
            $outW = $outH = min($maxEdge, $side);
        } else {
            [$srcX, $srcY, $srcW, $srcH] = [0, 0, $width, $height];
            $scale = min(1, $maxEdge / max($width, $height));
            $outW = max(1, (int) round($width * $scale));
            $outH = max(1, (int) round($height * $scale));
        }

        $canvas = imagecreatetruecolor($outW, $outH);
        // Fondo blanco por si el PNG/WebP trae transparencia (JPEG no la admite).
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $source, 0, 0, $srcX, $srcY, $outW, $outH, $srcW, $srcH);

        ob_start();
        imagejpeg($canvas, null, $quality);
        $jpeg = (string) ob_get_clean();

        imagedestroy($source);
        imagedestroy($canvas);

        return $jpeg;
    }
}
