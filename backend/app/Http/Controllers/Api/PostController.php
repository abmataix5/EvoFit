<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Models\WorkoutSession;
use App\Services\Feed\PostPresenter;
use App\Services\Feed\PostVisibility;
use App\Services\Feed\WorkoutSummaryBuilder;
use App\Services\Images\JpegEncoder;
use App\Services\Social\SocialGraph;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
    public function share(Request $request, WorkoutSession $workoutSession, WorkoutSummaryBuilder $summaries, JpegEncoder $encoder): JsonResponse
    {
        $this->authorize('update', $workoutSession);
        $validated = $request->validate([
            'caption' => ['nullable', 'string', 'max:500'],
            'gym_name' => ['nullable', 'string', 'max:80'],
            'photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
            'remove_photo' => ['sometimes', 'boolean'],
        ], [
            'photo.mimes' => 'La foto tiene que ser JPG, PNG o WebP.',
            'photo.max' => 'La foto pesa demasiado (máximo 12 MB).',
        ]);
        abort_unless($summaries->hasLoggedSets($workoutSession), 422, 'Este entreno aún no tiene series apuntadas.');

        $user = $request->user();
        $post = Post::query()->firstOrNew(['workout_session_id' => $workoutSession->id]);
        $created = ! $post->exists;
        $post->fill([
            'user_id' => $user->id,
            'caption' => blank($validated['caption'] ?? null) ? null : trim($validated['caption']),
            'gym_name' => array_key_exists('gym_name', $validated)
                ? (blank($validated['gym_name']) ? null : trim($validated['gym_name']))
                : ($post->gym_name ?? $user->gym_name),
            'summary' => $summaries->build($workoutSession),
        ]);

        $previousPhoto = $post->photo_path;
        if ($request->hasFile('photo')) {
            $path = 'posts/'.$user->id.'/'.Str::uuid()->toString().'.jpg';
            Storage::disk(Post::PHOTO_DISK)->put($path, $encoder->encode($request->file('photo'), 1440));
            $post->photo_path = $path;
        } elseif ($request->boolean('remove_photo')) {
            $post->photo_path = null;
        }

        $post->save();
        if ($previousPhoto && $previousPhoto !== $post->photo_path) {
            Storage::disk(Post::PHOTO_DISK)->delete($previousPhoto);
        }

        return response()->json([
            'data' => $this->presenter->present($post->load(PostPresenter::with()), $user, false),
        ], $created ? 201 : 200);
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
