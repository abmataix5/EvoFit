<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class WorkoutLogsTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    public function test_rpe_notes_and_completed_roundtrip(): void
    {
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());
        $press = $exercises['Press banca'];

        $this->actingAs($user)->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [
                ['routine_exercise_id' => $press->id, 'set_number' => 1, 'weight_kg' => 60, 'reps' => 8, 'rpe' => 7.5, 'notes' => ' Buena '],
                ['routine_exercise_id' => $press->id, 'set_number' => 2, 'weight_kg' => 60, 'reps' => 6, 'completed' => false],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.set_logs.0.rpe', 7.5)
            ->assertJsonPath('data.set_logs.0.notes', 'Buena')
            ->assertJsonPath('data.set_logs.0.completed', true)
            ->assertJsonPath('data.set_logs.1.rpe', null)
            ->assertJsonPath('data.set_logs.1.completed', false);

        // Sin rpe/notes en la petición: se conservan.
        $this->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [['routine_exercise_id' => $press->id, 'set_number' => 1, 'weight_kg' => 62.5, 'reps' => 8]],
        ])
            ->assertOk()
            ->assertJsonPath('data.set_logs.0.weight_kg', '62.50')
            ->assertJsonPath('data.set_logs.0.rpe', 7.5)
            ->assertJsonPath('data.set_logs.0.notes', 'Buena');

        $this->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [['routine_exercise_id' => $press->id, 'set_number' => 1, 'rpe' => 11]],
        ])->assertStatus(422)->assertJsonValidationErrors('sets.0.rpe');

        $this->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [['routine_exercise_id' => $press->id, 'set_number' => 21]],
        ])->assertStatus(422)->assertJsonValidationErrors('sets.0.set_number');
    }

    public function test_remove_sets_deletes_logs(): void
    {
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());
        $press = $exercises['Press banca'];
        $this->logSet($session, $press, 1, 50, 10);
        $this->logSet($session, $press, 2, 50, 10);
        $this->logSet($session, $press, 3, 50, 10);

        $this->actingAs($user)->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [],
            'remove_sets' => [['routine_exercise_id' => $press->id, 'set_number' => 3]],
        ])->assertOk()->assertJsonCount(2, 'data.set_logs');

        $this->assertSame([1, 2], $session->setLogs()->orderBy('set_number')->pluck('set_number')->all());
    }

    public function test_sync_rejects_exercises_from_other_days_or_users(): void
    {
        $user = $this->makeUser();
        [$routine, $day, $exercises] = $this->makeRoutine($user);
        $otherDay = $this->makeDay($routine, 2, 3, 'Día B');
        $foreignSameUser = $this->makeExercise($otherDay, 'Sentadilla');
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());

        $stranger = $this->makeUser('Bob');
        [, , $strangerExercises] = $this->makeRoutine($stranger);

        $this->actingAs($user);

        $this->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [['routine_exercise_id' => $foreignSameUser->id, 'set_number' => 1, 'weight_kg' => 100, 'reps' => 5]],
        ])->assertStatus(422)->assertJsonValidationErrors('sets.0.routine_exercise_id');

        $this->putJson("/api/v1/workout-sessions/{$session->id}/logs", [
            'sets' => [['routine_exercise_id' => $exercises['Press banca']->id, 'set_number' => 1, 'weight_kg' => 50, 'reps' => 5]],
            'remove_sets' => [['routine_exercise_id' => $strangerExercises['Press banca']->id, 'set_number' => 1]],
        ])->assertStatus(422)->assertJsonValidationErrors('remove_sets.0.routine_exercise_id');

        $this->assertSame(0, $session->setLogs()->count());
    }

    public function test_patch_session_notes_and_day(): void
    {
        $user = $this->makeUser();
        [$routine, $day] = $this->makeRoutine($user);
        $dayB = $this->makeDay($routine, 2, 3, 'Día B');
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());

        $this->actingAs($user)->patchJson("/api/v1/workout-sessions/{$session->id}", ['notes' => 'Hombro raro'])
            ->assertOk()
            ->assertJsonPath('data.notes', 'Hombro raro')
            ->assertJsonPath('data.routine_day_id', $day->id)
            ->assertJsonStructure(['data' => ['previous_lifts']]);

        $this->patchJson("/api/v1/workout-sessions/{$session->id}", ['routine_day_id' => $dayB->id, 'notes' => null])
            ->assertOk()
            ->assertJsonPath('data.notes', null)
            ->assertJsonPath('data.routine_day_id', $dayB->id)
            ->assertJsonPath('data.was_swapped', true);

        $this->patchJson("/api/v1/workout-sessions/{$session->id}", ['notes' => str_repeat('x', 2001)])
            ->assertStatus(422);
    }
}
