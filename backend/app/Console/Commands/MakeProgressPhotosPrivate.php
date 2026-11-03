<?php

namespace App\Console\Commands;

use App\Models\ProgressPhoto;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Mueve las fotos de progreso del disco público (storage/app/public, servido antes
 * por Caddy en /storage) al disco privado `local` (storage/app/private).
 * Idempotente: se puede ejecutar en cada arranque.
 */
class MakeProgressPhotosPrivate extends Command
{
    protected $signature = 'photos:make-private';

    protected $description = 'Mueve las fotos de progreso del disco público al privado';

    public function handle(): int
    {
        $public = Storage::disk('public');
        $private = Storage::disk('local');
        $moved = 0;
        $missing = 0;

        ProgressPhoto::query()
            ->withoutGlobalScopes()
            ->where('disk', '!=', 'local')
            ->orderBy('id')
            ->each(function (ProgressPhoto $photo) use ($public, $private, &$moved, &$missing): void {
                $path = $photo->path;

                if (! $private->exists($path)) {
                    if (! $public->exists($path)) {
                        $missing++;
                        $this->warn("Foto #{$photo->id}: no se encuentra {$path}");

                        return;
                    }

                    $stream = $public->readStream($path);
                    $ok = $private->writeStream($path, $stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                    if (! $ok || ! $private->exists($path) || $private->size($path) !== $public->size($path)) {
                        $this->error("Foto #{$photo->id}: no se pudo copiar {$path}");

                        return;
                    }
                }

                // Actualizar sin disparar eventos del modelo.
                ProgressPhoto::query()->withoutGlobalScopes()->whereKey($photo->id)->update(['disk' => 'local']);
                $public->delete($path);
                $moved++;
            });

        $this->info("Fotos privadas: {$moved} movidas, {$missing} sin archivo.");

        return self::SUCCESS;
    }
}
