<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class ExerciseHistoryTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    public function test_returns_entries_ascending_by_real_training_date(): void
    {
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user, ['Press banca' => [], 'Remo' => []]);
        $press = $exercises['Press banca'];

        $b = $this->makeSession($day, '2026-10-05', '2026-10-09 10:00:00');
        $this->logSet($b, $press, 1, 70, 5, ['rpe' => 9]);
        $this->logSet($b, $press, 2, 70, 8);
        $this->logSet($b, $press, 3, 60, 10);
        $this->logSet($b, $exercises['Remo'], 1, 50, 10);

        $a = $this->makeSession($day, '2026-10-12', '2026-10-02 10:00:00');
        $this->logSet($a, $press, 1, 65, 5);

        $this->makeSession($day, '2026-10-20'); // sin series: no aparece

        $response = $this->actingAs($user)
            ->getJson('/api/v1/exercise-history?routine_exercise_id='.$press->id)
            ->assertOk()
            ->assertJsonPath('data.name', 'Press banca')
            ->assertJsonPath('data.tracking_mode', 'weight_reps')
            ->assertJsonCount(2, 'data.entries');

        $entries = $response->json('data.entries');
        $this->assertSame(['2026-10-02', '2026-10-09'], array_column($entries, 'date'));
        $this->assertSame($b->id, $entries[1]['session_id']);
        $this->assertEquals(70, $entries[1]['best_weight_kg']);
        $this->assertSame(8, $entries[1]['best_reps']);
        $this->assertEquals(88.7, $entries[1]['est_1rm']); // 70 * (1 + 8/30)
        $this->assertEquals(70 * 5 + 70 * 8 + 60 * 10, $entries[1]['volume_kg']);
        $this->assertNull($entries[1]['best_duration_seconds']);
        $this->assertCount(3, $entries[1]['sets']);
        $this->assertEquals(9.0, $entries[1]['sets'][0]['rpe']);
        $this->assertSame(['set_number', 'weight_kg', 'reps', 'duration_seconds', 'rpe'], array_keys($entries[1]['sets'][0]));
    }

    public function test_requires_existing_owned_exercise(): void
    {
        $user = $this->makeUser();
        $this->actingAs($user)->getJson('/api/v1/exercise-history')->assertStatus(422);
        $this->getJson('/api/v1/exercise-history?routine_exercise_id=999')->assertNotFound();
    }
}
