<?php

namespace App\Notifications;

use App\Models\PostComment;
use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class PostCommented extends Notification
{
    public function __construct(private readonly User $by, private readonly PostComment $comment) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'post_comment',
            'actor_id' => $this->by->id,
            'post_id' => $this->comment->post_id,
            'excerpt' => Str::limit($this->comment->body, 80),
        ];
    }
}
