<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\Post;
use App\Models\User;
use App\Services\Social\ProfilePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request, ProfilePresenter $presenter): JsonResponse
    {
        $user = $request->user();
        $notifications = $user->notifications()->limit(50)->get();

        // Los datos del autor se leen ahora (no al crear el aviso): foto y nombre al día.
        $actors = User::query()
            ->whereIn('id', $notifications->pluck('data.actor_id')->filter()->unique())
            ->get()
            ->keyBy('id');
        $pendingIds = Friendship::query()
            ->whereIn('id', $notifications->pluck('data.friendship_id')->filter()->unique())
            ->where('status', Friendship::PENDING)
            ->pluck('id')
            ->all();
        // Avisos de publicaciones ya borradas: se omiten.
        $postIds = Post::query()
            ->whereIn('id', $notifications->pluck('data.post_id')->filter()->unique())
            ->pluck('id')
            ->flip();

        $data = $notifications
            ->map(function (DatabaseNotification $n) use ($actors, $pendingIds, $postIds, $presenter, $user) {
                $actor = $actors->get($n->data['actor_id'] ?? null);
                $postId = $n->data['post_id'] ?? null;
                if ($actor === null || ($postId !== null && ! isset($postIds[$postId]))) {
                    return null;
                }

                return [
                    'id' => $n->id,
                    'kind' => $n->data['kind'] ?? 'unknown',
                    'read' => $n->read_at !== null,
                    'created_at' => $n->created_at?->toIso8601String(),
                    'actor' => $presenter->card($actor, $user),
                    'friendship_id' => $n->data['friendship_id'] ?? null,
                    // Una solicitud ya aceptada o rechazada deja de mostrar botones.
                    'pending' => in_array($n->data['friendship_id'] ?? null, $pendingIds, true),
                    'post_id' => $postId,
                    'excerpt' => $n->data['excerpt'] ?? null,
                ];
            })
            ->filter()
            ->values();

        return response()->json(['data' => $data, 'unread' => $user->unreadNotifications()->count()]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['unread' => $request->user()->unreadNotifications()->count()]);
    }

    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['unread' => 0]);
    }

    /** Borra un aviso de la bandeja (solo los propios). Una solicitud pendiente sigue en Amigos. */
    public function destroy(Request $request, string $notification): JsonResponse
    {
        $request->user()->notifications()->whereKey($notification)->delete();

        return response()->json(['unread' => $request->user()->unreadNotifications()->count()]);
    }

    /** Vacía la bandeja entera, también los avisos antiguos que ya no se muestran. */
    public function destroyAll(Request $request): JsonResponse
    {
        $request->user()->notifications()->delete();

        return response()->json(['unread' => 0]);
    }
}
