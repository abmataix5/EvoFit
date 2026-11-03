<?php

namespace Tests\Feature;

use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class CalendarAndInsightsTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_calendar_plans_sessions_once_without_n_plus_one(): void
    {
        Carbon::setTestNow('2026-11-03 09:00:00');
        $user = $this->makeUser();
        [, $day] = $this->makeRoutine($user); // lunes
        $this->makeSession($day, '2026-11-09', '2026-11-09 08:00:00'); // ya existe: no se duplica

        $this->actingAs($user);
        DB::enableQueryLog();
        $this->getJson('/api/v1/workout-sessions/calendar?from=2026-11-01&to=2026-11-30')
            ->assertOk()
            ->assertJsonCount(5, 'data'); // lunes 2, 9, 16, 23, 30
        $queries = count(DB::getQueryLog());
        $this->assertLessThan(25, $queries, "Demasiadas consultas: {$queries}");

        $this->getJson('/api/v1/workout-sessions/calendar?from=2026-11-01&to=2026-11-30')->assertJsonCount(5, 'data');
        $this->assertSame(5, WorkoutSession::query()->count());
    }

    public function test_insights_use_real_training_date(): void
    {
        Carbon::setTestNow('2026-11-05 12:00:00'); // jueves; semana 2-8 nov
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user);

        // Planificada la semana pasada, entrenada esta semana.
        $session = $this->makeSession($day, '2026-10-26', '2026-11-03 18:00:00', ['completed_at' => '2026-11-03 19:00:00']);
        $this->logSet($session, $exercises['Press banca'], 1, 70, 5);

        $this->actingAs($user)->getJson('/api/v1/progress/insights')
            ->assertOk()
            ->assertJsonPath('training.sessions_completed', 1)
            ->assertJsonPath('exercises.0.status', 'new')
            ->assertJsonPath('exercises.0.current_best_kg', 70);
    }

    public function test_catalog_search_escapes_wildcards(): void
    {
        $user = $this->makeUser();
        $this->makeCatalog($user, 'Press 100% banca');
        $this->makeCatalog($user, 'Press banca');

        $this->actingAs($user)->getJson('/api/v1/catalog-exercises?q='.urlencode('%'))
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/catalog-exercises?q=_')->assertJsonCount(0, 'data');
    }
}
