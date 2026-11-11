<?php

namespace App\Services\Feed;

use App\Models\Post;
use App\Models\User;
use App\Services\Social\SocialGraph;

/**
 * Quién ve qué publicación: la del propio usuario siempre; la de otros, si su
 * privacidad lo permite (público, o "solo amigos" y sois amigos) y nadie ha bloqueado a nadie.
 */
class PostVisibility
{
    public function __construct(private readonly SocialGraph $graph) {}

    public function canView(User $viewer, Post $post): bool
    {
        if ($post->user_id === $viewer->id) {
            return true;
        }
        $author = $post->user;

        return $author !== null
            && ! in_array($author->id, $this->graph->hiddenIds($viewer), true)
            && $this->graph->canViewActivity($viewer, $author);
    }

    /**
     * Autores del feed de $viewer: él mismo y sus amigos que comparten su actividad.
     *
     * @return list<int>
     */
    public function feedAuthorIds(User $viewer): array
    {
        $friendIds = $this->graph->friendIds($viewer);
        $sharing = $friendIds === []
            ? []
            : User::query()->whereIn('id', $friendIds)->where('profile_visibility', '!=', 'private')->pluck('id')->all();

        return [$viewer->id, ...array_map('intval', $sharing)];
    }
}
