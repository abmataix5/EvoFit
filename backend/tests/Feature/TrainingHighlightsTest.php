<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class TrainingHighlightsTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_streak_and_last_record(): void
    {
        Carbon::setTestNow('2026-11-11 10:00:00'); // miércoles
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user, ['Press banca' => [], 'Remo' => []]);
        $press = $exercises['Press banca'];

        // Semanas del 19 oct, 26 oct y 2 nov: racha de 3 aunque esta semana aún no haya entreno.
        $s1 = $this->makeSession($day, '2026-10-20', '2026-10-20 18:00:00');
        $this->logSet($s1, $press, 1, 60, 8);
        $s2 = $this->makeSession($day, '2026-10-27', '2026-10-27 18:00:00', ['completed_at' => '2026-10-27 19:00:00']);
        $this->logSet($s2, $press, 1, 62.5, 8);
        $s3 = $this->makeSession($day, '2026-11-03', '2026-11-03 18:00:00');
        $this->logSet($s3, $press, 1, 65, 6);
        $this->logSet($s3, $press, 2, 67.5, 5);
        $this->logSet($s3, $exercises['Remo'], 1, 50, 10); // primera vez: no es récord
        // Planificada sin datos: no cuenta.
        $this->makeSession($day, '2026-11-10');

        $this->actingAs($user)->getJson('/api/v1/progress/highlights')
            ->assertOk()
            ->assertJsonPath('streak.weeks', 3)
            ->assertJsonPath('streak.this_week', 0)
            ->assertJsonPath('streak.best', 3)
            ->assertJsonPath('last_record.exercise', 'Press banca')
            ->assertJsonPath('last_record.weight_kg', 67.5)
            ->assertJsonPath('last_record.previous_kg', 62.5)
            ->assertJsonPath('last_record.date', '2026-11-03')
            ->assertJsonPath('month.sessions', 1);
    }

    public function test_streak_breaks_after_an_empty_week(): void
    {
        Carbon::setTestNow('2026-11-11 10:00:00');
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user);
        $s = $this->makeSession($day, '2026-10-20', '2026-10-20 18:00:00');
        $this->logSet($s, $exercises['Press banca'], 1, 60, 8);

        $this->actingAs($user)->getJson('/api/v1/progress/highlights')
            ->assertOk()
            ->assertJsonPath('streak.weeks', 0)
            ->assertJsonPath('streak.best', 1)
            ->assertJsonPath('last_record', null);
    }

    public function test_muscle_breakdown(): void
    {
        Carbon::setTestNow('2026-11-11 10:00:00');
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user, [
            'Press banca' => ['target_muscle' => 'pecho'],
            'Sentadilla' => ['target_muscle' => 'Pierna'],
            'Curl' => [],
        ]);
        $s = $this->makeSession($day, '2026-11-09', '2026-11-09 18:00:00');
        $this->logSet($s, $exercises['Press banca'], 1, 60, 10);
        $this->logSet($s, $exercises['Press banca'], 2, 60, 10);
        $this->logSet($s, $exercises['Sentadilla'], 1, 100, 5);
        $this->logSet($s, $exercises['Curl'], 1, 12, 10);

        $response = $this->actingAs($user)->getJson('/api/v1/progress/muscles?weeks=4')
            ->assertOk()
            ->assertJsonPath('weeks.3', '2026-11-09')
            ->assertJsonPath('muscles.0.name', 'Pecho')
            ->assertJsonPath('muscles.0.sets', 2)
            ->assertJsonPath('muscles.0.volume', 1200)
            ->assertJsonPath('muscles.0.weekly_sets.3.sets', 2);

        $names = collect($response->json('muscles'))->pluck('name')->all();
        $this->assertContains('Sin grupo', $names);
        $this->getJson('/api/v1/progress/muscles?weeks=100')->assertStatus(422);
    }
}
