<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Models\WorkoutSession;
use App\Services\Feed\PostPresenter;
use App\Services\Feed\PostVisibility;
use App\Services\Feed\PostWriter;
use App\Services\Feed\WorkoutSummaryBuilder;
use App\Services\Social\SocialGraph;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PostController extends Controller
{
    private const PAGE = 10;

    public function __construct(
        private readonly PostPresenter $presenter,
        private readonly PostVisibility $visibility,
    ) {}

    /** Entrenos míos y de mis amigos, del más reciente al más antiguo (paginado por cursor). */
    public function feed(Request $request): JsonResponse
    {
        $validated = $request->validate(['before' => ['nullable', 'integer', 'min:1']]);
        $viewer = $request->user();

        $posts = Post::query()
            ->with(PostPresenter::with())
            ->whereIn('user_id', $this->visibility->feedAuthorIds($viewer))
            ->when($validated['before'] ?? null, fn ($q, $before) => $q->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(self::PAGE + 1)
            ->get();

        return $this->page($posts, $viewer);
    }

    /** Entrenos compartidos por una persona (si su privacidad me deja verlos). */
    public function ofUser(Request $request, User $user, SocialGraph $graph): JsonResponse
    {
        $validated = $request->validate(['before' => ['nullable', 'integer', 'min:1']]);
        $viewer = $request->user();
        abort_if(in_array($user->id, $graph->hiddenIds($viewer), true), 404);
        abort_unless($graph->canViewActivity($viewer, $user), 403, 'Este perfil no comparte sus entrenos.');

        $posts = Post::query()
            ->with(PostPresenter::with())
            ->where('user_id', $user->id)
            ->when($validated['before'] ?? null, fn ($q, $before) => $q->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(self::PAGE + 1)
            ->get();

        return $this->page($posts, $viewer);
    }

    public function show(Request $request, Post $post): JsonResponse
    {
        abort_unless($this->visibility->canView($request->user(), $post), 404);

        return response()->json(['data' => $this->presenter->present($post->load(PostPresenter::with()), $request->user())]);
    }

    /**
     * Compartir (o editar lo compartido de) un entreno propio: resumen calculado aquí,
     * texto, gimnasio y foto opcional.
     */
    public function share(Request $request, WorkoutSession $workoutSession, WorkoutSummaryBuilder $summaries, PostWriter $writer): JsonResponse
    {
        $this->authorize('update', $workoutSession);
        $validated = $this->validatePostFields($request);
        abort_unless($summaries->hasLoggedSets($workoutSession), 422, 'Este entreno aún no tiene series apuntadas.');

        $post = Post::query()->firstOrNew(['workout_session_id' => $workoutSession->id]);
        $created = ! $post->exists;
        $writer->write($post, $request->user(), Arr::only($validated, ['caption', 'gym_name']), $request->file('photo'), $request->boolean('remove_photo'), $workoutSession);

        return response()->json([
            'data' => $this->presenter->present($post->load(PostPresenter::with()), $request->user()),
        ], $created ? 201 : 200);
    }

    /** Editar texto, gimnasio o foto de una publicación propia. */
    public function update(Request $request, Post $post, PostWriter $writer): JsonResponse
    {
        abort_unless($post->user_id === $request->user()->id, 404);
        $validated = $this->validatePostFields($request);

        // El resumen se recalcula si el entreno sigue existiendo (por si cambiaron las series).
        $session = $post->workout_session_id
            ? WorkoutSession::query()->where('user_id', $request->user()->id)->find($post->workout_session_id)
            : null;
        $writer->write($post, $request->user(), Arr::only($validated, ['caption', 'gym_name']), $request->file('photo'), $request->boolean('remove_photo'), $session);

        return response()->json(['data' => $this->presenter->present($post->load(PostPresenter::with()), $request->user())]);
    }

    /** Quién ha dado "me gusta" (los más recientes primero). */
    public function likers(Request $request, Post $post, SocialGraph $graph): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($this->visibility->canView($viewer, $post), 404);

        $users = User::query()
            ->join('post_likes', 'post_likes.user_id', '=', 'users.id')
            ->where('post_likes.post_id', $post->id)
            ->whereNotIn('users.id', $graph->hiddenIds($viewer))
            ->orderByDesc('post_likes.id')
            ->limit(200)
            ->get(['users.*']);

        return response()->json(['data' => $users->map(fn (User $u) => PostPresenter::author($u))->values()]);
    }

    /** @return array<string, mixed> */
    private function validatePostFields(Request $request): array
    {
        return $request->validate([
            'caption' => ['sometimes', 'nullable', 'string', 'max:500'],
            'gym_name' => ['sometimes', 'nullable', 'string', 'max:80'],
            'photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
            'remove_photo' => ['sometimes', 'boolean'],
        ], [
            'caption.max' => 'El texto puede tener como mucho 500 caracteres.',
            'photo.mimes' => 'La foto tiene que ser JPG, PNG o WebP.',
            'photo.max' => 'La foto pesa demasiado (máximo 12 MB).',
        ]);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        abort_unless($post->user_id === $request->user()->id, 404);
        $post->delete();

        return response()->json(['message' => 'Publicación eliminada.']);
    }

    public function photo(Request $request, Post $post): StreamedResponse
    {
        abort_unless($this->visibility->canView($request->user(), $post), 404);
        $disk = Storage::disk(Post::PHOTO_DISK);
        abort_unless($post->photo_path && $disk->exists($post->photo_path), 404);

        return $disk->response($post->photo_path, null, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function page($posts, User $viewer): JsonResponse
    {
        $hasMore = $posts->count() > self::PAGE;
        $posts = $posts->take(self::PAGE);

        return response()->json([
            'data' => $this->presenter->many($posts, $viewer),
            'next_before' => $hasMore ? $posts->last()?->id : null,
        ]);
    }
}
