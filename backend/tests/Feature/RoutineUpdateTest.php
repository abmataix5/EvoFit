<?php

namespace Tests\Feature;

use App\Models\RoutineDay;
use App\Models\RoutineExercise;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class RoutineUpdateTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-03 09:00:00'); // martes
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_partial_update_still_works(): void
    {
        $user = $this->makeUser();
        [$routine] = $this->makeRoutine($user);

        $this->actingAs($user)->patchJson("/api/v1/routines/{$routine->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.days_count', 1)
            ->assertJsonPath('data.exercises_count', 1);

        $this->patchJson("/api/v1/routines/{$routine->id}", ['starts_on' => '2026-11-01', 'ends_on' => null])
            ->assertOk()
            ->assertJsonPath('data.starts_on', '2026-11-01');
    }

    public function test_new_exercise_keeps_its_position_among_existing_ones(): void
    {
        $user = $this->makeUser();
        [$routine, $day, $exercises] = $this->makeRoutine($user, ['Press banca' => [], 'Remo' => []]);

        $this->actingAs($user)->putJson("/api/v1/routines/{$routine->id}", [
            'days' => [[
                'id' => $day->id,
                'day_index' => 1,
                'weekday' => $day->weekday,
                'name' => $day->name,
                'exercises' => [
                    ['name' => 'Fondos'],
                    ['id' => $exercises['Remo']->id, 'name' => 'Remo'],
                    ['id' => $exercises['Press banca']->id, 'name' => 'Press banca'],
                ],
            ]],
        ])->assertOk()
            ->assertJsonPath('data.days.0.exercises.0.name', 'Fondos')
            ->assertJsonPath('data.days.0.exercises.1.name', 'Remo')
            ->assertJsonPath('data.days.0.exercises.2.name', 'Press banca');
    }

    public function test_sync_days_archives_exercises_with_history_and_deletes_the_rest(): void
    {
        $user = $this->makeUser();
        [$routine, $day, $exercises] = $this->makeRoutine($user, ['Press banca' => [], 'Remo' => [], 'Curl' => []]);
        $press = $exercises['Press banca'];
        $remo = $exercises['Remo'];
        $curl = $exercises['Curl'];

        $past = $this->makeSession($day, '2026-10-27', '2026-10-27 18:00:00', ['completed_at' => '2026-10-27 19:00:00']);
        $log = $this->logSet($past, $remo, 1, 50, 10);

        $dayB = $this->makeDay($routine, 2, 3, 'Día B');
        $this->makeExercise($dayB, 'Sentadilla');

        // Sesión futura sin tocar del día B (miércoles): debe replanificarse.
        $staleFuture = $this->makeSession($dayB, '2026-11-04');

        $response = $this->actingAs($user)->putJson("/api/v1/routines/{$routine->id}", [
            'name' => 'Torso/Pierna',
            'days' => [
                [
                    'id' => $day->id,
                    'day_index' => 1,
                    'weekday' => 1,
                    'name' => 'Torso',
                    'exercises' => [
                        ['id' => $curl->id, 'name' => 'Curl', 'default_sets' => 4],
                        ['id' => $press->id, 'name' => 'Press banca', 'rest_seconds' => 120, 'notes' => 'Pausa abajo'],
                        ['name' => 'Fondos', 'tracking_mode' => 'weight_reps'],
                    ],
                ],
                [
                    'day_index' => 2,
                    'weekday' => 5,
                    'name' => 'Pierna',
                    'exercises' => [['name' => 'Prensa', 'default_reps' => 12]],
                ],
            ],
        ])->assertOk();

        $response->assertJsonPath('data.name', 'Torso/Pierna')
            ->assertJsonCount(2, 'data.days')
            ->assertJsonPath('data.days.0.id', $day->id)
            ->assertJsonPath('data.days.0.exercises.0.id', $curl->id)
            ->assertJsonPath('data.days.0.exercises.0.default_sets', 4)
            ->assertJsonPath('data.days.0.exercises.1.id', $press->id)
            ->assertJsonPath('data.days.0.exercises.1.rest_seconds', 120)
            ->assertJsonPath('data.days.0.exercises.1.notes', 'Pausa abajo')
            ->assertJsonPath('data.days.0.exercises.2.name', 'Fondos')
            ->assertJsonPath('data.days.1.name', 'Pierna')
            ->assertJsonPath('data.days.1.weekday', 5)
            ->assertJsonPath('data.exercises_count', 4);

        // Remo tenía series: archivado, con su historial intacto.
        $this->assertNotNull(RoutineExercise::query()->find($remo->id)?->archived_at);
        $this->assertNotNull($log->fresh());
        $this->assertSame($remo->id, $log->fresh()->routineExercise->id);

        // Día B sin historial: borrado con sus ejercicios.
        $this->assertNull(RoutineDay::query()->find($dayB->id));
        $this->assertSame(0, RoutineExercise::query()->where('name', 'Sentadilla')->count());
        $this->assertNull(WorkoutSession::query()->find($staleFuture->id));

        // El calendario refleja el viernes del nuevo día.
        $newDayId = $response->json('data.days.1.id');
        $this->assertTrue(WorkoutSession::query()
            ->where('routine_day_id', $newDayId)
            ->whereDate('scheduled_date', '2026-11-06')
            ->exists());

        // La sesión pasada sigue viendo el ejercicio archivado en sus series.
        $this->getJson("/api/v1/workout-sessions/{$past->id}")
            ->assertOk()
            ->assertJsonPath('data.set_logs.0.exercise.id', $remo->id);

        // Historial del ejercicio archivado sigue disponible.
        $this->getJson('/api/v1/exercise-history?routine_exercise_id='.$remo->id)
            ->assertOk()
            ->assertJsonCount(1, 'data.entries');
    }

    public function test_removing_a_day_with_history_archives_it(): void
    {
        $user = $this->makeUser();
        [$routine, $day, $exercises] = $this->makeRoutine($user);
        $dayB = $this->makeDay($routine, 2, 3, 'Día B');
        $squat = $this->makeExercise($dayB, 'Sentadilla');
        $session = $this->makeSession($dayB, '2026-10-28', '2026-10-28 18:00:00');
        $this->logSet($session, $squat, 1, 100, 5);

        $this->actingAs($user)->putJson("/api/v1/routines/{$routine->id}", [
            'days' => [[
                'id' => $day->id, 'day_index' => 1, 'weekday' => 1, 'name' => 'Día A',
                'exercises' => [['id' => $exercises['Press banca']->id, 'name' => 'Press banca']],
            ], [
                // Reutiliza el day_index del día archivado.
                'day_index' => 2, 'weekday' => 4, 'name' => 'Nuevo',
            ]],
        ])->assertOk()->assertJsonCount(2, 'data.days')->assertJsonPath('data.days.1.name', 'Nuevo');

        $this->assertNotNull($dayB->fresh()->archived_at);
        $this->assertNotNull($squat->fresh()->archived_at);
        $this->assertSame($dayB->id, $session->fresh()->routine_day_id);
    }

    public function test_validation_of_days(): void
    {
        $user = $this->makeUser();
        [$routine, $day] = $this->makeRoutine($user);
        $other = $this->makeUser('Bob');
        [, $otherDay, $otherExercises] = $this->makeRoutine($other);

        $this->actingAs($user);

        $this->putJson("/api/v1/routines/{$routine->id}", ['days' => [
            ['day_index' => 1, 'weekday' => 1, 'name' => 'A'],
            ['day_index' => 2, 'weekday' => 1, 'name' => 'B'],
        ]])->assertStatus(422)->assertJsonValidationErrors('days.1.weekday');

        $this->putJson("/api/v1/routines/{$routine->id}", ['days' => [
            ['day_index' => 1, 'weekday' => 1, 'name' => 'A'],
            ['day_index' => 1, 'weekday' => 2, 'name' => 'B'],
        ]])->assertStatus(422)->assertJsonValidationErrors('days.1.day_index');

        $this->putJson("/api/v1/routines/{$routine->id}", ['days' => [
            ['id' => $otherDay->id, 'day_index' => 1, 'weekday' => 1, 'name' => 'A',
                'exercises' => [['id' => $otherExercises['Press banca']->id, 'name' => 'X']]],
        ]])->assertStatus(422)->assertJsonValidationErrors(['days.0.id', 'days.0.exercises.0.id']);

        $this->assertSame('Día A', $day->fresh()->name);
    }

    public function test_store_rejects_duplicate_weekdays(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->postJson('/api/v1/routines', [
            'name' => 'X',
            'sessions_per_week' => 2,
            'days' => [
                ['day_index' => 1, 'weekday' => 1, 'name' => 'A', 'exercises' => [['name' => 'Press']]],
                ['day_index' => 2, 'weekday' => 1, 'name' => 'B'],
            ],
        ])->assertStatus(422);

        $this->postJson('/api/v1/routines', [
            'name' => 'X',
            'sessions_per_week' => 2,
            'days' => [
                ['day_index' => 1, 'weekday' => 1, 'name' => 'A', 'exercises' => [['name' => 'Press'], ['name' => 'Remo']]],
                ['day_index' => 2, 'weekday' => 4, 'name' => 'B'],
            ],
        ])->assertCreated()->assertJsonPath('routine.exercises_count', 2)->assertJsonPath('routine.days.0.exercises.1.sort_order', 1);
    }
}
