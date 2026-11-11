<?php

namespace App\Notifications;

use App\Models\Post;
use App\Models\User;
use Illuminate\Notifications\Notification;

class PostLiked extends Notification
{
    public function __construct(private readonly User $by, private readonly Post $post) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return ['kind' => 'post_like', 'actor_id' => $this->by->id, 'post_id' => $this->post->id];
    }
}
