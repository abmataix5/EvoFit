<?php

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class ProgressOverviewTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Miércoles: la semana en curso empieza el lunes 9.
        $this->travelTo(CarbonImmutable::parse('2026-11-11 18:00:00'));
    }

    public function test_overview_kpis_weekly_records_and_strength(): void
    {
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user, ['Press banca' => [], 'Remo' => []]);
        $bench = $exercises['Press banca'];

        // Periodo anterior (hace 5 semanas): 80 kg × 5.
        $old = $this->makeSession($day, '2026-10-07', '2026-10-07 18:00:00', ['completed_at' => '2026-10-07 18:45:00']);
        $this->logSet($old, $bench, 1, 80, 5);

        // Este periodo: 85 × 5 (récord) y luego 90 × 3 (otro récord).
        $a = $this->makeSession($day, '2026-10-28', '2026-10-28 18:00:00', ['completed_at' => '2026-10-28 18:50:00']);
        $this->logSet($a, $bench, 1, 85, 5);
        $this->logSet($a, $exercises['Remo'], 1, 60, 10);
        $b = $this->makeSession($day, '2026-11-10', '2026-11-10 18:00:00', ['completed_at' => '2026-11-10 19:00:00']);
        $this->logSet($b, $bench, 1, 90, 3);
        $this->logSet($b, $bench, 2, 70, 8, ['completed' => false]); // sin marcar: no cuenta

        $data = $this->actingAs($user)->getJson('/api/v1/progress/overview?weeks=4')->assertOk()->json();

        $this->assertSame('2026-10-19', $data['period']['from']);
        $this->assertSame(['workouts' => 2, 'sets' => 3, 'volume_kg' => 85 * 5 + 60 * 10 + 90 * 3, 'minutes' => 110, 'records' => 2], $data['kpis']['current']);
        $this->assertSame(1, $data['kpis']['previous']['workouts']);
        $this->assertSame(0, $data['kpis']['previous']['records']); // la primera vez no es récord

        $this->assertCount(4, $data['weekly']);
        $this->assertSame(['week_start' => '2026-11-09', 'workouts' => 1, 'sets' => 1, 'volume_kg' => 270], $data['weekly'][3]);

        $this->assertSame('2026-11-10', $data['records'][0]['date']);
        $this->assertEquals(90, $data['records'][0]['weight_kg']);
        $this->assertEquals(85, $data['records'][0]['previous_kg']);

        $benchStrength = collect($data['exercises'])->firstWhere('name', 'Press banca');
        $this->assertSame(2, $benchStrength['sessions']);
        $this->assertEquals(round(85 * (1 + 5 / 30), 1), $benchStrength['points'][0]['e1rm']);
        $this->assertEquals(round(90 * 1.1, 1), $benchStrength['points'][1]['e1rm']);
        $this->assertEquals(90, $benchStrength['all_time_best_kg']);
        $this->assertNotNull($benchStrength['change_pct']);

        $this->assertArrayHasKey('2026-11-10', $data['calendar']['days']);
        $this->assertArrayHasKey('2026-10-07', $data['calendar']['days']);
    }

    public function test_overview_validates_range_and_is_private(): void
    {
        $user = $this->makeUser();
        $this->actingAs($user)->getJson('/api/v1/progress/overview?weeks=7')->assertJsonValidationErrors('weeks');
        $this->actingAs($user)->getJson('/api/v1/progress/overview')->assertOk()->assertJsonPath('range_weeks', 12);

        // Los datos de otro usuario no se mezclan.
        $other = $this->makeUser('Otro');
        [, $day, $exercises] = $this->makeRoutine($other);
        $s = $this->makeSession($day, '2026-11-10', '2026-11-10 18:00:00');
        $this->logSet($s, $exercises['Press banca'], 1, 100, 5);
        $this->actingAs($user)->getJson('/api/v1/progress/overview')->assertJsonPath('kpis.current.sets', 0);
    }
}
