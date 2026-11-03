<?php

namespace App\Policies;

use App\Models\Routine;
use App\Models\User;

class RoutinePolicy
{
    use OwnedByUser;

    public function view(User $user, Routine $routine): bool
    {
        return $this->owns($user, $routine);
    }

    public function update(User $user, Routine $routine): bool
    {
        return $this->owns($user, $routine);
    }

    public function delete(User $user, Routine $routine): bool
    {
        return $this->owns($user, $routine);
    }
}
