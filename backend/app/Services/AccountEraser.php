<?php

namespace App\Services;

use App\Models\Post;
use App\Models\ProgressPhoto;
use App\Models\Story;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Borrado definitivo de una cuenta (derecho de supresión): el usuario, todo lo que ha creado
 * (rutinas, entrenos, publicaciones, historias, mensajes, amistades…) y sus archivos en disco.
 */
class AccountEraser
{
    public function erase(User $user): void
    {
        // Primero los archivos: las filas se van en cascada y después ya no sabríamos dónde estaban.
        Post::query()->where('user_id', $user->id)->get()->each->deletePhotoFile();
        Story::query()->where('user_id', $user->id)->get()->each->delete();
        ProgressPhoto::query()->withoutGlobalScope('tenant')->where('user_id', $user->id)->get()->each->delete();
        $user->deleteAvatarFile();

        DB::transaction(function () use ($user): void {
            // Avisos recibidos y los que otros tienen sobre esta persona (no llevan clave ajena).
            DB::table('notifications')
                ->where(fn ($q) => $q
                    ->where(fn ($own) => $own->where('notifiable_type', $user->getMorphClass())->where('notifiable_id', $user->id))
                    ->orWhere('data->actor_id', $user->id))
                ->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();

            $tenantId = $user->tenant_id;
            $shared = $tenantId !== null && User::query()->where('tenant_id', $tenantId)->where('id', '!=', $user->id)->exists();

            // Lo social cuelga del usuario; rutinas, entrenos y progreso, de su espacio. Ambos borran en cascada.
            $user->delete();
            if ($tenantId !== null && ! $shared) {
                Tenant::query()->whereKey($tenantId)->delete();
            }
        });
    }
}
