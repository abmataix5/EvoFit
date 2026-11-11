<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
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

        $data = $notifications
            ->map(function (DatabaseNotification $n) use ($actors, $pendingIds, $presenter, $user) {
                $actor = $actors->get($n->data['actor_id'] ?? null);
                if ($actor === null) {
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
}
