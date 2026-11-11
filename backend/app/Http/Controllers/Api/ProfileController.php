<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\UpdateAvatarRequest;
use App\Http\Requests\Profile\UpdatePasswordRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AvatarProcessor;
use App\Services\TrainingHighlightsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProfileController extends Controller
{
    public function update(UpdateProfileRequest $request): UserResource
    {
        $user = $request->user();
        $user->fill($request->validated())->save();

        return new UserResource($user->load('tenant'));
    }

    public function stats(Request $request, TrainingHighlightsService $service): JsonResponse
    {
        return response()->json($service->profileStats($request->user()));
    }

    public function updateAvatar(UpdateAvatarRequest $request, AvatarProcessor $avatars): UserResource
    {
        $user = $avatars->replace($request->user(), $request->file('avatar'));

        return new UserResource($user->load('tenant'));
    }

    public function destroyAvatar(Request $request, AvatarProcessor $avatars): UserResource
    {
        $user = $avatars->remove($request->user());

        return new UserResource($user->load('tenant'));
    }

    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['password' => $request->validated('password')])->save();

        // Cierra la sesión en el resto de dispositivos; esta sigue abierta.
        Auth::guard('web')->logoutOtherDevices($request->validated('password'));
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json(['message' => 'Contraseña actualizada.']);
    }

    /**
     * Foto de perfil de cualquier usuario, para cualquiera con sesión: como en
     * cualquier red social, la foto se ve aunque el perfil sea privado.
     */
    public function avatar(User $user): StreamedResponse
    {
        $disk = Storage::disk(User::AVATAR_DISK);
        abort_unless($user->avatar_path && $disk->exists($user->avatar_path), 404);

        return $disk->response($user->avatar_path, null, [
            'Content-Type' => 'image/jpeg',
            // La URL lleva versión (?v=): se puede cachear mucho tiempo.
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
