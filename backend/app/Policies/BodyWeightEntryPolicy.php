<?php

namespace App\Policies;

use App\Models\BodyWeightEntry;
use App\Models\User;

class BodyWeightEntryPolicy
{
    use OwnedByUser;

    public function view(User $user, BodyWeightEntry $entry): bool
    {
        return $this->owns($user, $entry);
    }

    public function delete(User $user, BodyWeightEntry $entry): bool
    {
        return $this->owns($user, $entry);
    }
}
