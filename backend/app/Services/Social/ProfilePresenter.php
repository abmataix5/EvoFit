<?php

namespace App\Services\Social;

use App\Models\Post;
use App\Models\User;
use App\Services\TrainingHighlightsService;

/**
 * Cómo ve un usuario a otro: lo básico siempre (nombre, foto, @usuario) y el resto
 * según la privacidad del perfil y si sois amigos.
 */
class ProfilePresenter
{
    public function __construct(
        private readonly SocialGraph $graph,
        private readonly TrainingHighlightsService $highlights,
        private readonly WeeklyLeague $league,
    ) {}

    /**
     * Tarjeta para listas (búsqueda, amigos, notificaciones).
     *
     * @return array<string, mixed>
     */
    public function card(User $user, User $viewer, ?array $relation = null): array
    {
        $relation ??= $this->graph->relation($viewer, $user);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'avatar_url' => $user->avatarUrl(),
            'location' => $user->location,
            'relation' => $relation['status'],
            'friendship_id' => $relation['friendship_id'],
        ];
    }

    /**
     * Perfil completo tal y como lo ve $viewer.
     *
     * @return array<string, mixed>
     */
    public function profile(User $user, User $viewer): array
    {
        $relation = $this->graph->relation($viewer, $user);
        $canView = $this->graph->canViewActivity($viewer, $user);
        $isSelf = $relation['status'] === SocialGraph::SELF;

        return [
            ...$this->card($user, $viewer, $relation),
            'bio' => $user->bio,
            'age' => ($user->show_age || $isSelf) ? $user->age() : null,
            'gym_name' => $user->gym_name,
            'experience_level' => $user->experience_level?->value,
            'training_goal' => $user->training_goal?->value,
            'member_since' => $user->created_at?->toDateString(),
            'profile_visibility' => $user->profile_visibility?->value,
            'friends_count' => count($this->graph->friendIds($user)),
            'can_view_activity' => $canView,
            'blocked_by_me' => ! $isSelf && $this->graph->hasBlocked($viewer, $user),
            'stats' => $canView ? $this->highlights->profileStats($user) : null,
            // Semanas en las que quedó primero en su liga de amigos.
            'league_wins' => $canView ? $this->league->wins($user) : null,
            'posts_count' => $canView ? Post::query()->where('user_id', $user->id)->count() : null,
            'height_cm' => $canView ? $user->height_cm : null,
        ];
    }
}
