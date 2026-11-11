<?php

namespace App\Services\Stories;

use App\Models\Story;
use App\Models\User;
use App\Services\Feed\PostVisibility;
use App\Services\Social\SocialGraph;

/**
 * Las historias se ven como los entrenos (misma privacidad), pero solo mientras duran.
 */
class StoryVisibility
{
    public function __construct(
        private readonly SocialGraph $graph,
        private readonly PostVisibility $posts,
    ) {}

    public function canView(User $viewer, Story $story): bool
    {
        if (! $story->isActive()) {
            return false;
        }
        if ($story->user_id === $viewer->id) {
            return true;
        }
        $author = $story->user;

        return $author !== null
            && ! in_array($author->id, $this->graph->hiddenIds($viewer), true)
            && $this->graph->canViewActivity($viewer, $author);
    }

    /** Autores de la barra de historias: yo y mis amigos que comparten su actividad. @return list<int> */
    public function barAuthorIds(User $viewer): array
    {
        return $this->posts->feedAuthorIds($viewer);
    }
}
