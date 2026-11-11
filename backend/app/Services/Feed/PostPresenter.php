<?php

namespace App\Services\Feed;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostLike;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Cómo se envía una publicación al móvil (con lo que depende de quién mira: si le ha
 * dado "me gusta", si puede borrarla…).
 */
class PostPresenter
{
    /** Relaciones que necesita present(): cárgalas en la consulta para no hacer N consultas. */
    public static function with(): array
    {
        return [
            'user',
            'comments' => fn ($q) => $q->with('user')->latest('id')->limit(2),
        ];
    }

    /**
     * @param  Collection<int, Post>  $posts
     * @return list<array<string, mixed>>
     */
    public function many(Collection $posts, User $viewer): array
    {
        $liked = $posts->isEmpty() ? [] : PostLike::query()
            ->where('user_id', $viewer->id)
            ->whereIn('post_id', $posts->pluck('id'))
            ->pluck('post_id')
            ->flip()
            ->all();
        $likers = $this->latestLikers($posts, $viewer);

        return $posts
            ->map(fn (Post $post) => $this->present($post, $viewer, isset($liked[$post->id]), $likers[$post->id] ?? null))
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    public function present(Post $post, User $viewer, ?bool $likedByMe = null, ?User $liker = null): array
    {
        $likedByMe ??= $post->likes()->where('user_id', $viewer->id)->exists();
        $liker ??= $this->latestLikers(collect([$post]), $viewer)[$post->id] ?? null;
        $mine = $post->user_id === $viewer->id;

        return [
            'id' => $post->id,
            'author' => self::author($post->user),
            'created_at' => $post->created_at?->toIso8601String(),
            'caption' => $post->caption,
            'gym_name' => $post->gym_name,
            'photo_url' => $post->photoUrl(),
            'summary' => $post->summary,
            'likes_count' => $post->likes_count,
            'comments_count' => $post->comments_count,
            'liked_by_me' => $likedByMe,
            // "Le gusta a Ana y 11 más": la última persona (que no seas tú) que dio "me gusta".
            'liked_by' => self::author($liker),
            'edited' => $post->edited_at !== null,
            'comments_preview' => $post->relationLoaded('comments')
                ? $post->comments->sortBy('id')->map(fn (PostComment $c) => $this->comment($c, $viewer, $post))->values()->all()
                : [],
            'mine' => $mine,
            'workout_session_id' => $mine ? $post->workout_session_id : null,
        ];
    }

    /**
     * Última persona (distinta de quien mira) que ha dado "me gusta" a cada publicación.
     *
     * @param  Collection<int, Post>  $posts
     * @return array<int, User>
     */
    private function latestLikers(Collection $posts, User $viewer): array
    {
        $withLikes = $posts->filter(fn (Post $p) => $p->likes_count > 0)->pluck('id');
        if ($withLikes->isEmpty()) {
            return [];
        }

        $likes = PostLike::query()
            ->whereIn('post_id', $withLikes)
            ->where('user_id', '!=', $viewer->id)
            ->orderByDesc('id')
            ->get(['post_id', 'user_id'])
            ->unique('post_id');
        $users = User::query()->whereIn('id', $likes->pluck('user_id'))->get()->keyBy('id');

        return $likes->mapWithKeys(fn (PostLike $l) => [$l->post_id => $users->get($l->user_id)])->filter()->all();
    }

    /** @return array<string, mixed> */
    public function comment(PostComment $comment, User $viewer, Post $post): array
    {
        return [
            'id' => $comment->id,
            'body' => $comment->body,
            'created_at' => $comment->created_at?->toIso8601String(),
            'author' => self::author($comment->user),
            // Borra quien lo escribió o el dueño de la publicación.
            'can_delete' => $comment->user_id === $viewer->id || $post->user_id === $viewer->id,
        ];
    }

    /** @return array<string, mixed>|null */
    public static function author(?User $user): ?array
    {
        return $user ? [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'avatar_url' => $user->avatarUrl(),
        ] : null;
    }
}
