<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\User;
use App\Services\Social\Friendships;
use App\Services\Social\ProfilePresenter;
use App\Services\Social\SocialGraph;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FriendController extends Controller
{
    public function __construct(
        private readonly Friendships $friendships,
        private readonly ProfilePresenter $presenter,
        private readonly SocialGraph $graph,
    ) {}

    /** Mis amigos. */
    public function index(Request $request): JsonResponse
    {
        return $this->friendsOf($request->user(), $request->user());
    }

    /** Los amigos de otro, si puedo ver su actividad. */
    public function ofUser(Request $request, User $user): JsonResponse
    {
        return $this->friendsOf($user, $request->user());
    }

    private function friendsOf(User $owner, User $viewer): JsonResponse
    {
        abort_unless($this->graph->canViewActivity($viewer, $owner), 403, 'Este perfil no comparte su lista de amigos.');

        $hidden = $this->graph->hiddenIds($viewer);
        $friends = User::query()
            ->whereIn('id', array_diff($this->graph->friendIds($owner), $hidden))
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $friends->map(fn (User $friend) => $this->presenter->card($friend, $viewer))->values(),
        ]);
    }

    public function requests(Request $request): JsonResponse
    {
        $user = $request->user();
        $pending = Friendship::query()
            ->with(['requester', 'addressee'])
            ->where('status', Friendship::PENDING)
            ->where(fn ($q) => $q->where('requester_id', $user->id)->orWhere('addressee_id', $user->id))
            ->latest()
            ->get();

        $present = fn (Friendship $f) => [
            'id' => $f->id,
            'created_at' => $f->created_at?->toIso8601String(),
            'user' => $this->presenter->card($f->requester_id === $user->id ? $f->addressee : $f->requester, $user),
        ];

        return response()->json([
            'incoming' => $pending->where('addressee_id', $user->id)->map($present)->values(),
            'outgoing' => $pending->where('requester_id', $user->id)->map($present)->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);
        $to = User::query()->findOrFail($validated['user_id']);

        $this->friendships->request($request->user(), $to);

        return response()->json(['data' => $this->presenter->card($to, $request->user())], 201);
    }

    public function accept(Request $request, Friendship $friendship): JsonResponse
    {
        $this->friendships->accept($friendship, $request->user());

        return response()->json(['data' => $this->presenter->card($friendship->requester, $request->user())]);
    }

    public function dismiss(Request $request, Friendship $friendship): JsonResponse
    {
        $other = User::query()->findOrFail($friendship->otherUserId($request->user()->id));
        $this->friendships->dismiss($friendship, $request->user());

        return response()->json(['data' => $this->presenter->card($other, $request->user())]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->friendships->unfriend($request->user(), $user);

        return response()->json(['data' => $this->presenter->card($user, $request->user())]);
    }
}
