<?php

namespace Tests\Feature;

use App\Models\RoutineExercise;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class SessionExercisesTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    private function setUpDay(): array
    {
        $user = $this->makeUser();
        [$routine, $day, $exercises] = $this->makeRoutine($user, [
            'Press banca' => ['default_sets' => 4, 'default_reps' => 6, 'rest_seconds' => 120],
            'Remo' => [],
        ]);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());

        return [$user, $routine, $day, $exercises, $session];
    }

    public function test_swap_exercise_for_today_keeps_routine_untouched(): void
    {
        [$user, $routine, $day, $exercises, $session] = $this->setUpDay();
        $dumbbell = $this->makeCatalog($user, 'Press con mancuernas', ['default_sets' => 3, 'default_reps' => 10]);

        $response = $this->actingAs($user)->postJson("/api/v1/workout-sessions/{$session->id}/exercises", [
            'catalog_exercise_id' => $dumbbell->id,
            'replaces_routine_exercise_id' => $exercises['Press banca']->id,
        ])->assertOk();

        // Ocupa el sitio del original y conserva lo planificado (4×6, 120 s).
        $response->assertJsonPath('data.exercises.0.name', 'Press con mancuernas')
            ->assertJsonPath('data.exercises.0.session_only', true)
            ->assertJsonPath('data.exercises.0.replaces_routine_exercise_id', $exercises['Press banca']->id)
            ->assertJsonPath('data.exercises.0.default_sets', 4)
            ->assertJsonPath('data.exercises.0.default_reps', 6)
            ->assertJsonPath('data.exercises.0.rest_seconds', 120)
            ->assertJsonPath('data.exercises.1.name', 'Remo')
            ->assertJsonCount(2, 'data.exercises');

        // La rutina no cambia.
        $this->actingAs($user)->getJson("/api/v1/routines/{$routine->id}")
            ->assertJsonCount(2, 'data.days.0.exercises')
            ->assertJsonPath('data.days.0.exercises.0.name', 'Press banca')
            ->assertJsonPath('data.exercises_count', 2);
    }

    public function test_added_exercise_goes_last_and_accepts_sets(): void
    {
        [$user, , , , $session] = $this->setUpDay();

        $response = $this->actingAs($user)->postJson("/api/v1/workout-sessions/{$session->id}/exercises", [
            'name' => 'Fondos',
        ])->assertOk()
            ->assertJsonCount(3, 'data.exercises')
            ->assertJsonPath('data.exercises.2.name', 'Fondos');

        $extraId = $response->json('data.exercises.2.id');

        // Se crea en el catálogo del usuario.
        $this->assertDatabaseHas('catalog_exercises', ['user_id' => $user->id, 'name' => 'Fondos']);

        $this->actingAs($user)->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [['routine_exercise_id' => $extraId, 'set_number' => 1, 'weight_kg' => 10, 'reps' => 12]],
        ])->assertOk()->assertJsonPath('data.set_logs.0.routine_exercise_id', $extraId);
    }

    public function test_cannot_swap_exercise_with_logged_sets(): void
    {
        [$user, , , $exercises, $session] = $this->setUpDay();
        $this->logSet($session, $exercises['Press banca'], 1, 80, 6);

        $this->actingAs($user)->postJson("/api/v1/workout-sessions/{$session->id}/exercises", [
            'name' => 'Press inclinado',
            'replaces_routine_exercise_id' => $exercises['Press banca']->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('replaces_routine_exercise_id');
    }

    public function test_swapping_a_swap_replaces_it_and_removing_restores_original(): void
    {
        [$user, , , $exercises, $session] = $this->setUpDay();
        $original = $exercises['Press banca'];

        $first = $this->actingAs($user)->postJson("/api/v1/workout-sessions/{$session->id}/exercises", [
            'name' => 'Press inclinado',
            'replaces_routine_exercise_id' => $original->id,
        ])->json('data.exercises.0.id');

        $second = $this->actingAs($user)->postJson("/api/v1/workout-sessions/{$session->id}/exercises", [
            'name' => 'Press con mancuernas',
            'replaces_routine_exercise_id' => $first,
        ])->assertOk()
            ->assertJsonPath('data.exercises.0.name', 'Press con mancuernas')
            ->assertJsonPath('data.exercises.0.replaces_routine_exercise_id', $original->id)
            ->assertJsonCount(2, 'data.exercises')
            ->json('data.exercises.0.id');

        $this->assertDatabaseMissing('routine_exercises', ['id' => $first]);

        $this->actingAs($user)->deleteJson("/api/v1/workout-sessions/{$session->id}/exercises/{$second}")
            ->assertOk()
            ->assertJsonPath('data.exercises.0.id', $original->id)
            ->assertJsonCount(2, 'data.exercises');
    }

    public function test_routine_exercises_cannot_be_removed_through_session_endpoint(): void
    {
        [$user, , , $exercises, $session] = $this->setUpDay();

        $this->actingAs($user)->deleteJson("/api/v1/workout-sessions/{$session->id}/exercises/{$exercises['Remo']->id}")
            ->assertNotFound();
        $this->assertDatabaseHas('routine_exercises', ['id' => $exercises['Remo']->id]);
    }

    public function test_other_sessions_extras_are_rejected_in_logs(): void
    {
        [$user, , $day, , $session] = $this->setUpDay();
        $other = $this->makeSession($day, now()->addDay()->toDateString(), now()->toDateTimeString());

        $extraId = $this->actingAs($user)->postJson("/api/v1/workout-sessions/{$other->id}/exercises", ['name' => 'Fondos'])
            ->json('data.exercises.2.id');

        $this->actingAs($user)->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [['routine_exercise_id' => $extraId, 'set_number' => 1, 'weight_kg' => 10]],
        ])->assertUnprocessable();
    }

    public function test_other_users_cannot_change_session(): void
    {
        [, , , , $session] = $this->setUpDay();
        $intruder = $this->makeUser('Intruso');

        $this->actingAs($intruder)->postJson("/api/v1/workout-sessions/{$session->id}/exercises", ['name' => 'Fondos'])
            ->assertNotFound();
    }

    public function test_editing_routine_keeps_session_extras_and_their_sets(): void
    {
        [$user, $routine, $day, $exercises, $session] = $this->setUpDay();

        $extraId = $this->actingAs($user)->postJson("/api/v1/workout-sessions/{$session->id}/exercises", ['name' => 'Fondos'])
            ->json('data.exercises.2.id');
        $this->logSet($session, RoutineExercise::query()->find($extraId), 1, 0, 12);

        // Guardar la rutina sin tocar nada no debe archivar ni borrar el añadido de la sesión.
        $routineJson = $this->actingAs($user)->getJson("/api/v1/routines/{$routine->id}")->json('data');
        $this->actingAs($user)->putJson("/api/v1/routines/{$routine->id}", [
            'name' => $routineJson['name'],
            'sessions_per_week' => 1,
            'days' => [[
                'id' => $day->id,
                'day_index' => 1,
                'weekday' => 1,
                'name' => 'Día A',
                'exercises' => collect($routineJson['days'][0]['exercises'])->map(fn ($e, $i) => [
                    'id' => $e['id'],
                    'name' => $e['name'],
                    'catalog_exercise_id' => $e['catalog_exercise_id'],
                    'sort_order' => $i,
                ])->all(),
            ]],
        ])->assertSuccessful();

        $extra = RoutineExercise::query()->find($extraId);
        $this->assertNotNull($extra);
        $this->assertNull($extra->archived_at);
        $this->assertSame(1, $extra->setLogs()->count());
    }
}
