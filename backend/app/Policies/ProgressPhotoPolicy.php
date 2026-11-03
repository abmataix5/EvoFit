<?php

namespace App\Policies;

use App\Models\ProgressPhoto;
use App\Models\User;

class ProgressPhotoPolicy
{
    use OwnedByUser;

    public function view(User $user, ProgressPhoto $photo): bool
    {
        return $this->owns($user, $photo);
    }

    public function delete(User $user, ProgressPhoto $photo): bool
    {
        return $this->owns($user, $photo);
    }
}
