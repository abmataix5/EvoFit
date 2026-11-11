<?php

namespace App\Notifications;

use App\Models\Friendship;
use App\Models\User;
use Illuminate\Notifications\Notification;

class FriendRequestReceived extends Notification
{
    public function __construct(private readonly User $from, private readonly Friendship $friendship) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'friend_request',
            'actor_id' => $this->from->id,
            'friendship_id' => $this->friendship->id,
        ];
    }
}
