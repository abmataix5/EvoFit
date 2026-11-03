<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class PreviousLiftsTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    public function test_uses_real_training_time_skips_sessions_without_kg_and_returns_records(): void
    {
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user);
        $press = $exercises['Press banca'];

        // Planificada más tarde pero entrenada antes.
        $early = $this->makeSession($day, '2026-10-20', '2026-10-14 18:00:00');
        $this->logSet($early, $press, 1, 100, 3);
        $this->logSet($early, $press, 2, 90, 6);

        // Planificada antes pero entrenada después: es la "última".
        $late = $this->makeSession($day, '2026-10-13', '2026-10-16 18:00:00');
        $this->logSet($late, $press, 1, 80, 8);
        $this->logSet($late, $press, 2, 82.5, 6);

        // Más reciente aún, pero sin kilos: se salta.
        $noKg = $this->makeSession($day, '2026-10-18', '2026-10-18 18:00:00');
        $this->logSet($noKg, $press, 1, null, 12);

        // Récord de peso con dos repeticiones distintas (empate).
        $tie = $this->makeSession($day, '2026-10-01', '2026-10-01 18:00:00');
        $this->logSet($tie, $press, 1, 100, 2);
        $this->logSet($tie, $press, 2, 100, 4, ['completed' => false]); // no completada: no cuenta

        // Posterior a la sesión actual: no debe verse.
        $future = $this->makeSession($day, '2026-11-20', '2026-11-20 18:00:00');
        $this->logSet($future, $press, 1, 200, 1);

        $current = $this->makeSession($day, '2026-10-19', '2026-10-19 18:00:00');

        $response = $this->actingAs($user)->getJson("/api/v1/workout-sessions/{$current->id}")->assertOk();
        $this->assertStringContainsString('"previous_lifts":{"'.$press->id.'":', $response->getContent());
        $lift = $response->json('data.previous_lifts.'.$press->id);

        $this->assertSame('2026-10-16', $lift['recorded_on']);
        $this->assertEquals(82.5, $lift['best_weight_kg']);
        $this->assertSame(6, $lift['best_reps']);
        $this->assertCount(2, $lift['sets']);
        $this->assertEquals(100, $lift['record_weight_kg']);
        $this->assertSame(3, $lift['record_reps']);
        // Epley: 100 * (1 + 3/30) = 110 (> 90x6 = 108)
        $this->assertEquals(110.0, $lift['record_est_1rm']);
        $this->assertNull($lift['record_duration_seconds']);
    }

    public function test_matches_by_catalog_or_name_across_routines_and_timed_records(): void
    {
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user, [
            'Plancha' => ['tracking_mode' => 'time', 'time_direction' => 'longer'],
            'Remo' => [],
        ]);
        $plank = $exercises['Plancha'];

        // Otra rutina, mismo catálogo.
        [, $otherDay] = $this->makeRoutine($user, []);
        $samePlank = $this->makeExercise($otherDay, 'Plancha', $plank->catalog_exercise_id, 0, ['tracking_mode' => 'time', 'time_direction' => 'longer']);
        // Ejercicio sin catálogo con el mismo nombre (en minúsculas) cuenta para Remo.
        $legacyRow = $this->makeExercise($otherDay, 'remo ', null, 1);

        $past = $this->makeSession($otherDay, '2026-10-10', '2026-10-10 10:00:00');
        $this->logSet($past, $samePlank, 1, null, null, ['duration_seconds' => 60]);
        $this->logSet($past, $samePlank, 2, null, null, ['duration_seconds' => 95]);
        $this->logSet($past, $legacyRow, 1, 40, 10);

        $current = $this->makeSession($day, '2026-10-12', '2026-10-12 10:00:00');
        $lifts = $this->actingAs($user)->getJson("/api/v1/workout-sessions/{$current->id}")->json('data.previous_lifts');

        $this->assertSame(95, $lifts[$plank->id]['best_duration_seconds']);
        $this->assertSame(95, $lifts[$plank->id]['record_duration_seconds']);
        $this->assertNull($lifts[$plank->id]['record_est_1rm']);
        $this->assertEquals(40, $lifts[$exercises['Remo']->id]['record_weight_kg']);
        $this->assertEquals(53.3, $lifts[$exercises['Remo']->id]['record_est_1rm']);
    }
}
