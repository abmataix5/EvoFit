<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    protected $fillable = ['conversation_id', 'sender_id', 'body', 'story_id', 'reaction', 'story_reply'];

    protected function casts(): array
    {
        return ['story_reply' => 'boolean'];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }
}
