<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostLike;
use App\Notifications\PostCommented;
use App\Notifications\PostLiked;
use App\Services\Feed\PostPresenter;
use App\Services\Feed\PostVisibility;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * "Me gusta" y comentarios. Los contadores se guardan en la publicación para que el
 * feed no tenga que contarlos en cada carga.
 */
class PostInteractionController extends Controller
{
    public function __construct(
        private readonly PostVisibility $visibility,
        private readonly PostPresenter $presenter,
    ) {}

    public function like(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->visibility->canView($user, $post), 404);

        try {
            DB::transaction(function () use ($post, $user) {
                PostLike::query()->create(['post_id' => $post->id, 'user_id' => $user->id]);
                $post->increment('likes_count');
            });
            if ($post->user_id !== $user->id) {
                $post->user->notify(new PostLiked($user, $post));
            }
        } catch (UniqueConstraintViolationException) {
            // Ya le había dado "me gusta" (doble toque): no cuenta dos veces.
        }

        return $this->likeState($post, true);
    }

    public function unlike(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->visibility->canView($user, $post), 404);

        DB::transaction(function () use ($post, $user) {
            $deleted = PostLike::query()->where('post_id', $post->id)->where('user_id', $user->id)->delete();
            if ($deleted > 0 && $post->likes_count > 0) {
                $post->decrement('likes_count');
            }
        });

        return $this->likeState($post, false);
    }

    public function comments(Request $request, Post $post): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($this->visibility->canView($viewer, $post), 404);

        $comments = $post->comments()->with('user')->orderBy('id')->limit(300)->get();

        return response()->json([
            'data' => $comments->map(fn (PostComment $c) => $this->presenter->comment($c, $viewer, $post))->values(),
        ]);
    }

    public function comment(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->visibility->canView($user, $post), 404);
        $validated = $request->validate(['body' => ['required', 'string', 'max:500']], [
            'body.required' => 'Escribe algo.',
            'body.max' => 'El comentario puede tener como mucho 500 caracteres.',
        ]);
        $body = trim($validated['body']);
        abort_if($body === '', 422, 'Escribe algo.');

        $comment = DB::transaction(function () use ($post, $user, $body) {
            $comment = PostComment::query()->create(['post_id' => $post->id, 'user_id' => $user->id, 'body' => $body]);
            $post->increment('comments_count');

            return $comment;
        });

        if ($post->user_id !== $user->id) {
            $post->user->notify(new PostCommented($user, $comment));
        }

        return response()->json(['data' => $this->presenter->comment($comment->load('user'), $user, $post)], 201);
    }

    public function destroyComment(Request $request, PostComment $comment): JsonResponse
    {
        $user = $request->user();
        $post = $comment->post;
        abort_unless($comment->user_id === $user->id || $post?->user_id === $user->id, 404);

        DB::transaction(function () use ($comment, $post) {
            $comment->delete();
            if ($post && $post->comments_count > 0) {
                $post->decrement('comments_count');
            }
        });

        return response()->json(['comments_count' => $post?->comments_count ?? 0]);
    }

    private function likeState(Post $post, bool $liked): JsonResponse
    {
        return response()->json(['likes_count' => $post->fresh()->likes_count, 'liked_by_me' => $liked]);
    }
}
