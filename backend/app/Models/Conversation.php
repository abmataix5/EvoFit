<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Conversación privada entre dos usuarios.
 */
class Conversation extends Model
{
    protected $fillable = ['user_one_id', 'user_two_id', 'user_one_last_read_id', 'user_two_last_read_id', 'last_message_at'];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }

    /** La conversación entre dos usuarios (la crea si no existe). */
    public static function between(User $a, User $b): self
    {
        [$one, $two] = $a->id < $b->id ? [$a->id, $b->id] : [$b->id, $a->id];

        return self::query()->firstOrCreate(['user_one_id' => $one, 'user_two_id' => $two]);
    }

    /** @param  Builder<Conversation>  $query */
    public function scopeFor(Builder $query, User $user): void
    {
        $query->where(fn ($q) => $q->where('user_one_id', $user->id)->orWhere('user_two_id', $user->id));
    }

    public function includes(User $user): bool
    {
        return $this->user_one_id === $user->id || $this->user_two_id === $user->id;
    }

    public function otherUserId(User $user): int
    {
        return $this->user_one_id === $user->id ? $this->user_two_id : $this->user_one_id;
    }

    public function lastReadIdFor(User $user): int
    {
        return (int) ($this->user_one_id === $user->id ? $this->user_one_last_read_id : $this->user_two_last_read_id);
    }

    /** Marca como leído hasta el último mensaje (o hasta $messageId). */
    public function markReadBy(User $user, ?int $messageId = null): void
    {
        $messageId ??= (int) $this->messages()->max('id');
        $column = $this->user_one_id === $user->id ? 'user_one_last_read_id' : 'user_two_last_read_id';
        if ($messageId > (int) $this->{$column}) {
            $this->forceFill([$column => $messageId])->save();
        }
    }

    public function userOne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_one_id');
    }

    public function userTwo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_two_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }
}
