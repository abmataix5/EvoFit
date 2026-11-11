<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Amistad entre dos usuarios: una solicitud (pending) que, al aceptarse, es mutua (accepted).
 */
class Friendship extends Model
{
    public const PENDING = 'pending';

    public const ACCEPTED = 'accepted';

    protected $fillable = ['requester_id', 'addressee_id', 'status', 'accepted_at'];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function addressee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'addressee_id');
    }

    /** La relación entre dos usuarios, en cualquier sentido. */
    public static function between(int $a, int $b): ?self
    {
        return self::query()
            ->where(fn (Builder $q) => $q->where('requester_id', $a)->where('addressee_id', $b))
            ->orWhere(fn (Builder $q) => $q->where('requester_id', $b)->where('addressee_id', $a))
            ->first();
    }

    public function otherUserId(int $userId): int
    {
        return $this->requester_id === $userId ? $this->addressee_id : $this->requester_id;
    }

    public function involves(int $userId): bool
    {
        return $this->requester_id === $userId || $this->addressee_id === $userId;
    }
}
