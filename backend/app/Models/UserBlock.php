<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserBlock extends Model
{
    protected $fillable = ['blocker_id', 'blocked_id'];

    /** ¿Alguno de los dos ha bloqueado al otro? */
    public static function eitherWay(int $a, int $b): bool
    {
        return self::query()
            ->where(fn ($q) => $q->where('blocker_id', $a)->where('blocked_id', $b))
            ->orWhere(fn ($q) => $q->where('blocker_id', $b)->where('blocked_id', $a))
            ->exists();
    }
}
