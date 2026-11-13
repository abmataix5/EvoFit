<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Mail\WelcomeMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\PersonalAccessToken;
use Throwable;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $payload = $request->validated();

        $user = DB::transaction(function () use ($payload) {
            $tenant = Tenant::query()->create([
                'name' => $payload['workspace_name'] ?? ($payload['name'].' · EvoFit'),
                'slug' => Str::slug($payload['name'].'-'.Str::random(6)),
                'plan' => 'free',
            ]);

            $user = User::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $payload['name'],
                'username' => $payload['username'],
                'email' => $payload['email'],
                'password' => $payload['password'],
                'role' => 'owner',
            ]);
            $user->forceFill(['terms_accepted_at' => now()])->save();

            return $user;
        });

        $token = $this->startSession($request, $user);

        // La bienvenida sale después de responder: si el correo falla, la cuenta ya está creada.
        defer(function () use ($user) {
            try {
                Mail::to($user)->send(new WelcomeMail($user));
            } catch (Throwable $e) {
                Log::warning('No se pudo enviar el email de bienvenida', ['to' => $user->id, 'error' => $e->getMessage()]);
            }
        });

        return response()->json([
            'user' => new UserResource($user->load('tenant')),
            ...($token !== null ? ['token' => $token] : []),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->safe()->only(['email', 'password']);

        // Las apps del móvil no usan cookies: se comprueba la contraseña y se les da un token.
        if ($this->isApp($request)) {
            if (! Auth::validate($credentials)) {
                return response()->json(['message' => 'Credenciales incorrectas.'], 422);
            }
            $user = User::query()->where('email', $credentials['email'])->firstOrFail();

            return response()->json([
                'user' => new UserResource($user->load('tenant')),
                'token' => $this->startSession($request, $user),
            ]);
        }

        if (! Auth::attempt($credentials, remember: true)) {
            return response()->json([
                'message' => 'Credenciales incorrectas.',
            ], 422);
        }

        $request->session()->regenerate();

        return response()->json([
            'user' => new UserResource($request->user()->load('tenant')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        // En las apps, cerrar sesión es anular el token de ese móvil; en la web, cerrar la sesión de cookies.
        $token = $request->user()?->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();

            return response()->json(['message' => 'Sesión cerrada.']);
        }

        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Sesión cerrada.']);
    }

    /** Las apps de iOS y Android se identifican mandando el nombre del dispositivo. */
    private function isApp(Request $request): bool
    {
        return $request->filled('device_name');
    }

    /**
     * Abre la sesión tras registrarse o entrar: cookie en la web, token en las apps.
     * Devuelve el token (solo para apps) o null.
     */
    private function startSession(Request $request, User $user): ?string
    {
        if ($this->isApp($request)) {
            return $user->createToken(Str::limit((string) $request->input('device_name'), 100, ''))->plainTextToken;
        }

        Auth::login($user);
        $request->session()->regenerate();

        return null;
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('tenant'));
    }
}
