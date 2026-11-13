<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Dirección de una imagen protegida (avatar, foto de entreno, historia, foto de progreso).
 *
 * La web las pide con su cookie de sesión, así que le basta la ruta. Las apps de iOS y Android
 * no tienen cookie y una etiqueta de imagen no puede mandar el token: reciben una dirección
 * completa y firmada, que solo vale para esa imagen, para esa persona y durante un tiempo.
 */
class MediaUrl
{
    /**
     * @param  string  $route  Nombre de la ruta de la imagen.
     * @param  array<string, mixed>  $parameters
     */
    public static function to(string $route, array $parameters): string
    {
        $user = auth()->user();
        $isApp = $user !== null && method_exists($user, 'currentAccessToken') && $user->currentAccessToken() instanceof PersonalAccessToken;

        if (! $isApp) {
            return URL::route($route, $parameters, absolute: false);
        }

        $path = URL::temporarySignedRoute($route, self::expiry(), [...$parameters, 'viewer' => $user->getKey()], absolute: false);

        return rtrim((string) config('app.url'), '/').$path;
    }

    /**
     * Caduca al final de la semana siguiente: la dirección no cambia durante toda la semana
     * (así el móvil guarda la imagen en caché) y vale entre 7 y 14 días.
     */
    private static function expiry(): Carbon
    {
        return now()->startOfWeek()->addWeeks(2);
    }
}
