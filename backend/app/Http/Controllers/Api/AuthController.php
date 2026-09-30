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
use Illuminate\Support\Facades\DB;
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

            return User::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $payload['name'],
                'email' => $payload['email'],
                'password' => $payload['password'],
                'role' => 'owner',
            ]);
        });

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'user' => new UserResource($user->load('tenant')),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

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
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Sesión cerrada.']);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('tenant'));
    }
}
