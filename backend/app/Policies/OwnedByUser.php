<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Regla común: solo el dueño (user_id) dentro de su tenant.
 */
trait OwnedByUser
{
    protected function owns(User $user, Model $model): bool
    {
        return (int) $model->getAttribute('user_id') === (int) $user->id
            && (int) $model->getAttribute('tenant_id') === (int) $user->tenant_id;
    }
}
