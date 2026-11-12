<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Throwable;

/**
 * Recuperar la contraseña por email: se pide un enlace y, con él, se elige una nueva.
 */
class PasswordResetController extends Controller
{
    /**
     * Envía el enlace si el email tiene cuenta. La respuesta es siempre la misma: así nadie
     * puede usar esta pantalla para averiguar qué emails están registrados.
     */
    public function forgot(Request $request): JsonResponse
    {
        $email = $request->validate(
            ['email' => ['required', 'email', 'max:255']],
            ['email.required' => 'Escribe tu email.', 'email.email' => 'Escribe un email válido.'],
        )['email'];

        $user = User::query()->where('email', $email)->first();
        $broker = Password::broker();

        // Un enlace por minuto como mucho: evita que alguien llene de correos un buzón ajeno.
        if ($user !== null && ! $broker->getRepository()->recentlyCreatedToken($user)) {
            $token = $broker->createToken($user);
            defer(function () use ($user, $token) {
                try {
                    Mail::to($user)->send(new ResetPasswordMail($user, $token));
                } catch (Throwable $e) {
                    Log::warning('No se pudo enviar el email de recuperación de contraseña', ['to' => $user->id, 'error' => $e->getMessage()]);
                }
            });
        }

        return response()->json([
            'message' => 'Si hay una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña.',
        ]);
    }

    /** Cambia la contraseña con el enlace recibido (caduca y solo vale una vez). */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ], [
            'password.required' => 'Elige una contraseña.',
            'password.min' => 'La contraseña necesita al menos :min caracteres.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ]);

        $status = Password::broker()->reset($data, function (User $user, string $password): void {
            // Con la contraseña nueva, las sesiones "recordadas" en otros dispositivos dejan de valer.
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
        });

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'El enlace no es válido o ha caducado. Pide uno nuevo.',
                'errors' => ['token' => ['El enlace no es válido o ha caducado. Pide uno nuevo.']],
            ], 422);
        }

        return response()->json(['message' => 'Contraseña cambiada. Ya puedes iniciar sesión.']);
    }
}
