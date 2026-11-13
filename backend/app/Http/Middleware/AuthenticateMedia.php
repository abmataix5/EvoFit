<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Acceso a las imágenes protegidas: con sesión (web), con token (apps) o con una dirección
 * firmada de las que el servidor entrega a las apps (ver App\Support\MediaUrl).
 * Con la firma, la imagen se sirve como si la pidiera la persona para la que se firmó.
 */
class AuthenticateMedia
{
    public function __construct(private Authenticate $authenticate) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->query('signature') === null) {
            return $this->authenticate->handle($request, $next, 'sanctum');
        }

        abort_unless($request->hasValidRelativeSignature(), 401, 'El enlace de la imagen no es válido o ha caducado.');

        $viewer = User::query()->find((int) $request->query('viewer'));
        abort_if($viewer === null, 401, 'El enlace de la imagen no es válido o ha caducado.');

        Auth::shouldUse('sanctum');
        Auth::guard('sanctum')->setUser($viewer);

        return $next($request);
    }
}
