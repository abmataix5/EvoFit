<?php

namespace App\Services\Social;

use App\Enums\ProfileVisibility;
use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;

/**
 * Quién es qué para quién: amistades, bloqueos y qué puede ver cada uno de un perfil.
 */
class SocialGraph
{
    public const SELF = 'self';

    public const NONE = 'none';

    /** Yo envié la solicitud y está pendiente. */
    public const OUTGOING = 'outgoing';

    /** Me la enviaron y está pendiente. */
    public const INCOMING = 'incoming';

    public const FRIENDS = 'friends';

    /** @return array{status: string, friendship_id: int|null} */
    public function relation(User $viewer, User $user): array
    {
        if ($viewer->id === $user->id) {
            return ['status' => self::SELF, 'friendship_id' => null];
        }

        $friendship = Friendship::between($viewer->id, $user->id);
        if ($friendship === null) {
            return ['status' => self::NONE, 'friendship_id' => null];
        }

        $status = match (true) {
            $friendship->status === Friendship::ACCEPTED => self::FRIENDS,
            $friendship->requester_id === $viewer->id => self::OUTGOING,
            default => self::INCOMING,
        };

        return ['status' => $status, 'friendship_id' => $friendship->id];
    }

    public function areFriends(User $a, User $b): bool
    {
        return $this->relation($a, $b)['status'] === self::FRIENDS;
    }

    /**
     * ¿Puede ver estadísticas y entrenos? El dueño siempre; público, cualquiera;
     * "solo amigos", sus amigos; privado, nadie más.
     */
    public function canViewActivity(User $viewer, User $owner): bool
    {
        if ($viewer->id === $owner->id) {
            return true;
        }

        return match ($owner->profile_visibility ?? ProfileVisibility::Friends) {
            ProfileVisibility::Public => true,
            ProfileVisibility::Friends => $this->areFriends($viewer, $owner),
            ProfileVisibility::Private => false,
        };
    }

    /** @return list<int> */
    public function friendIds(User $user): array
    {
        return Friendship::query()
            ->where('status', Friendship::ACCEPTED)
            ->where(fn ($q) => $q->where('requester_id', $user->id)->orWhere('addressee_id', $user->id))
            ->get(['requester_id', 'addressee_id'])
            ->map(fn (Friendship $f) => $f->otherUserId($user->id))
            ->values()
            ->all();
    }

    /** Usuarios que he bloqueado o que me han bloqueado: no nos vemos en búsquedas ni perfiles. @return list<int> */
    public function hiddenIds(User $user): array
    {
        return UserBlock::query()
            ->where('blocker_id', $user->id)
            ->orWhere('blocked_id', $user->id)
            ->get(['blocker_id', 'blocked_id'])
            ->map(fn (UserBlock $b) => $b->blocker_id === $user->id ? $b->blocked_id : $b->blocker_id)
            ->unique()
            ->values()
            ->all();
    }

    public function hasBlocked(User $blocker, User $blocked): bool
    {
        return UserBlock::query()->where('blocker_id', $blocker->id)->where('blocked_id', $blocked->id)->exists();
    }
}
