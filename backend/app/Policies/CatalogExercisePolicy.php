<?php

namespace App\Policies;

use App\Models\CatalogExercise;
use App\Models\User;

class CatalogExercisePolicy
{
    use OwnedByUser;

    public function view(User $user, CatalogExercise $exercise): bool
    {
        return $this->owns($user, $exercise);
    }

    public function update(User $user, CatalogExercise $exercise): bool
    {
        return $this->owns($user, $exercise);
    }

    public function delete(User $user, CatalogExercise $exercise): bool
    {
        return $this->owns($user, $exercise);
    }
}
