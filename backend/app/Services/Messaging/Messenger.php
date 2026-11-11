<?php

namespace App\Services\Messaging;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Story;
use App\Models\User;
use App\Services\Social\SocialGraph;
use Illuminate\Support\Facades\DB;

/**
 * Mensajes privados: solo entre amigos y nunca si uno ha bloqueado al otro.
 */
class Messenger
{
    public function __construct(private readonly SocialGraph $graph) {}

    public function canMessage(User $from, User $to): bool
    {
        return $from->id !== $to->id
            && ! in_array($to->id, $this->graph->hiddenIds($from), true)
            && $this->graph->areFriends($from, $to);
    }

    /**
     * @param  array{body?: string|null, reaction?: string|null, story?: Story|null}  $content
     */
    public function send(User $from, User $to, array $content): Message
    {
        abort_unless($this->canMessage($from, $to), 403, 'Solo puedes escribir a tus amigos.');

        return DB::transaction(function () use ($from, $to, $content) {
            $conversation = Conversation::between($from, $to);
            $story = $content['story'] ?? null;

            $message = $conversation->messages()->create([
                'sender_id' => $from->id,
                'body' => blank($content['body'] ?? null) ? null : trim((string) $content['body']),
                'reaction' => $content['reaction'] ?? null,
                'story_id' => $story?->id,
                'story_reply' => $story !== null,
            ]);

            $conversation->forceFill(['last_message_at' => $message->created_at])->save();
            $conversation->markReadBy($from, $message->id);

            return $message;
        });
    }

    /** Mensajes del otro sin leer en esa conversación. */
    public function unreadIn(Conversation $conversation, User $user): int
    {
        return $conversation->messages()
            ->where('sender_id', '!=', $user->id)
            ->where('id', '>', $conversation->lastReadIdFor($user))
            ->count();
    }
}
