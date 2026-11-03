<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkoutSession;

class WorkoutSessionPolicy
{
    use OwnedByUser;

    public function view(User $user, WorkoutSession $session): bool
    {
        return $this->owns($user, $session);
    }

    public function update(User $user, WorkoutSession $session): bool
    {
        return $this->owns($user, $session);
    }
}
