<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class WorkoutReportTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    /** Genera un mes de datos de ejemplo y deja los PDF en storage/app/private/report-samples si se pide. */
    private function seedWeek(): array
    {
        $user = $this->makeUser('Ana');
        [, $day, $exercises] = $this->makeRoutine($user, [
            'Press banca' => ['default_sets' => 3, 'default_reps' => 8, 'target_muscle' => 'Pecho'],
            'Sentadilla' => ['default_sets' => 3, 'default_reps' => 6, 'target_muscle' => 'Pierna'],
            'Plancha' => ['default_sets' => 2, 'default_reps' => 0, 'tracking_mode' => 'time', 'time_direction' => 'longer'],
        ]);

        $monday = $this->makeSession($day, '2026-11-02', '2026-11-02 17:05:00', [
            'completed_at' => '2026-11-02 18:12:00',
            'notes' => "Buenas sensaciones.\nHombro algo cargado.",
        ]);
        $this->logSet($monday, $exercises['Press banca'], 1, 60, 10, ['rpe' => 7]);
        $this->logSet($monday, $exercises['Press banca'], 2, 65, 8, ['rpe' => 8, 'notes' => 'Última costó']);
        $this->logSet($monday, $exercises['Press banca'], 3, 65, 7, ['completed' => false]);
        $this->logSet($monday, $exercises['Sentadilla'], 1, 90, 6);
        $this->logSet($monday, $exercises['Sentadilla'], 2, 92.5, 6);
        $this->logSet($monday, $exercises['Plancha'], 1, null, null, ['duration_seconds' => 75]);
        $this->logSet($monday, $exercises['Plancha'], 2, null, null, ['duration_seconds' => 90]);

        $thursday = $this->makeSession($day, '2026-11-05', '2026-11-05 08:00:00', ['completed_at' => '2026-11-05 08:55:00']);
        $this->logSet($thursday, $exercises['Press banca'], 1, 67.5, 6);
        $this->logSet($thursday, $exercises['Sentadilla'], 1, 95, 5);

        // Planificada sin datos: no debe salir.
        $this->makeSession($day, '2026-11-07');

        return [$user, $monday, $thursday];
    }

    public function test_week_report_is_a_pdf_with_the_sessions(): void
    {
        [$user] = $this->seedWeek();

        $response = $this->actingAs($user)
            ->get('/api/v1/reports/workouts?from=2026-11-02&to=2026-11-08&tz=Europe/Madrid')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->assertStringContainsString('evofit-semana-2026-11-02.pdf', (string) $response->headers->get('content-disposition'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
        $this->saveSample('semana.pdf', $response->getContent());
    }

    public function test_day_month_and_session_reports(): void
    {
        [$user, $monday] = $this->seedWeek();

        $day = $this->actingAs($user)->get('/api/v1/reports/workouts?from=2026-11-02&to=2026-11-02')->assertOk();
        $this->assertStringContainsString('evofit-dia-2026-11-02.pdf', (string) $day->headers->get('content-disposition'));
        $this->saveSample('dia.pdf', $day->getContent());

        $month = $this->get('/api/v1/reports/workouts?from=2026-11-01&to=2026-11-30')->assertOk();
        $this->assertStringContainsString('evofit-mes-2026-11.pdf', (string) $month->headers->get('content-disposition'));
        $this->saveSample('mes.pdf', $month->getContent());

        $session = $this->get("/api/v1/workout-sessions/{$monday->id}/report")->assertOk()
            ->assertHeader('content-type', 'application/pdf');
        $this->saveSample('sesion.pdf', $session->getContent());
    }

    public function test_empty_period_and_validation(): void
    {
        [$user] = $this->seedWeek();

        $this->actingAs($user)->getJson('/api/v1/reports/workouts?from=2026-11-07&to=2026-11-07')
            ->assertNotFound()
            ->assertJsonPath('message', 'No hay entrenamientos registrados en ese periodo.');

        $this->getJson('/api/v1/reports/workouts?from=2026-11-08&to=2026-11-01')->assertStatus(422);
        $this->getJson('/api/v1/reports/workouts?from=2024-01-01&to=2026-11-01')->assertStatus(422);
        $this->getJson('/api/v1/reports/workouts?from=2026-11-01&to=2026-11-02&tz=Nope/Nope')->assertStatus(422);
    }

    public function test_other_users_cannot_download_a_session_report(): void
    {
        [, $monday] = $this->seedWeek();
        $intruder = $this->makeUser('Eva');

        $this->actingAs($intruder)->getJson("/api/v1/workout-sessions/{$monday->id}/report")
            ->assertNotFound();

        $this->getJson('/api/v1/reports/workouts?from=2026-11-01&to=2026-11-30')->assertNotFound();
    }

    private function saveSample(string $name, string $content): void
    {
        if (! env('SAVE_REPORT_SAMPLES')) {
            return;
        }
        @mkdir(storage_path('app/private/report-samples'), 0777, true);
        file_put_contents(storage_path('app/private/report-samples/'.$name), $content);
    }
}
