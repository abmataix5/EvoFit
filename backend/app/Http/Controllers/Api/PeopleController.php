<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserReport;
use App\Services\Social\Friendships;
use App\Services\Social\ProfilePresenter;
use App\Services\Social\SocialGraph;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Buscar personas, ver su perfil, bloquear y denunciar.
 */
class PeopleController extends Controller
{
    public function __construct(
        private readonly SocialGraph $graph,
        private readonly ProfilePresenter $presenter,
    ) {}

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate(['q' => ['required', 'string', 'min:2', 'max:60']]);
        $viewer = $request->user();
        $term = ltrim(trim($validated['q']), '@');
        $like = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($term));

        $users = User::query()
            ->whereKeyNot($viewer->id)
            ->whereNotIn('id', $this->graph->hiddenIds($viewer))
            ->where(function ($q) use ($like) {
                $q->whereRaw("username LIKE ? ESCAPE '!'", [$like.'%'])
                    ->orWhereRaw("LOWER(name) LIKE ? ESCAPE '!'", ['%'.$like.'%']);
            })
            // Primero quien coincide por @usuario exacto, luego por inicio de nombre.
            ->orderByRaw('CASE WHEN username = ? THEN 0 WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END', [mb_strtolower($term), $like.'%'])
            ->orderBy('name')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => $users->map(fn (User $user) => $this->presenter->card($user, $viewer))->values(),
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();
        // Si me ha bloqueado, para mí no existe.
        abort_if($viewer->id !== $user->id && $this->graph->hasBlocked($user, $viewer), 404);

        return response()->json(['data' => $this->presenter->profile($user, $viewer)]);
    }

    public function block(Request $request, User $user, Friendships $friendships): JsonResponse
    {
        $friendships->block($request->user(), $user);

        return response()->json(['data' => $this->presenter->profile($user, $request->user())]);
    }

    public function unblock(Request $request, User $user, Friendships $friendships): JsonResponse
    {
        $friendships->unblock($request->user(), $user);

        return response()->json(['data' => $this->presenter->profile($user, $request->user())]);
    }

    public function report(Request $request, User $user): JsonResponse
    {
        abort_if($request->user()->id === $user->id, 422, 'No puedes denunciarte a ti mismo.');
        $validated = $request->validate([
            'reason' => ['required', Rule::in(UserReport::REASONS)],
            'details' => ['nullable', 'string', 'max:500'],
        ]);

        UserReport::query()->create([
            'reporter_id' => $request->user()->id,
            'reported_user_id' => $user->id,
            ...$validated,
        ]);

        return response()->json(['message' => 'Gracias. Revisaremos la denuncia.'], 201);
    }
}
