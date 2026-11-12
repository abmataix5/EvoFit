<?php

namespace Tests\Feature;

use App\Enums\ProfileVisibility;
use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class LeagueTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    private function befriend(User $a, User $b): void
    {
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => 'accepted', 'accepted_at' => now()]);
    }

    /** Entrena un día: una sesión con las series dadas [kg, reps]. */
    private function train(User $user, string $date, array $sets, ?array $routine = null): array
    {
        $routine ??= $this->makeRoutine($user);
        [, $day, $exercises] = $routine;
        $session = $this->makeSession($day, $date, $date.' 10:00:00', ['trained_on' => $date]);
        foreach ($sets as $index => [$kg, $reps]) {
            $this->logSet($session, $exercises['Press banca'], $index + 1, $kg, $reps);
        }

        return $routine;
    }

    public function test_weekly_league_counts_days_volume_and_records_among_friends(): void
    {
        // Miércoles 18 de noviembre de 2026 (la semana va del lunes 16 al domingo 22).
        $this->travelTo(CarbonImmutable::parse('2026-11-18 12:00:00', 'UTC'));

        $me = $this->makeUser('Abel');
        $ana = $this->makeUser('Ana');
        $luis = $this->makeUser('Luis');
        $stranger = $this->makeUser('Desconocido');
        $this->befriend($me, $ana);
        $this->befriend($luis, $me);

        // Yo: semana pasada 60 kg; esta semana dos días y un récord (62,5 kg).
        $mine = $this->train($me, '2026-11-10', [[60, 8]]);
        $this->train($me, '2026-11-16', [[60, 8], [62.5, 6]], $mine);
        $this->train($me, '2026-11-17', [[60, 8]], $mine);
        // Ana: un día esta semana, más kilos; es su primera vez con el ejercicio (no es récord).
        $this->train($ana, '2026-11-17', [[100, 10], [100, 10]]);
        // Luis no ha entrenado; el desconocido sí, pero no es amigo.
        $this->train($stranger, '2026-11-16', [[200, 10]]);

        $response = $this->actingAs($me)->getJson('/api/v1/league')->assertOk();
        $response->assertJsonPath('week.from', '2026-11-16')
            ->assertJsonPath('week.to', '2026-11-22')
            ->assertJsonPath('week.current', true)
            ->assertJsonPath('week.days_left', 5)
            ->assertJsonCount(3, 'entries');

        $entries = collect($response->json('entries'))->keyBy(fn ($entry) => $entry['user']['id']);
        $this->assertTrue($entries[$me->id]['me']);
        $this->assertSame(2, $entries[$me->id]['days']);
        $this->assertSame(3, $entries[$me->id]['sets']);
        $this->assertSame(1335, $entries[$me->id]['volume_kg']);
        $this->assertSame(1, $entries[$me->id]['records']);
        $this->assertSame(1, $entries[$ana->id]['days']);
        $this->assertSame(2000, $entries[$ana->id]['volume_kg']);
        $this->assertSame(0, $entries[$ana->id]['records']);
        $this->assertSame(0, $entries[$luis->id]['days']);
        $this->assertArrayNotHasKey($stranger->id, $entries->all());

        // La semana pasada: solo mi entreno del día 10.
        $last = $this->getJson('/api/v1/league?weeks_ago=1')->assertOk()
            ->assertJsonPath('week.from', '2026-11-09')
            ->assertJsonPath('week.current', false)
            ->assertJsonPath('week.days_left', 0);
        $lastEntries = collect($last->json('entries'))->keyBy(fn ($entry) => $entry['user']['id']);
        $this->assertSame(1, $lastEntries[$me->id]['days']);
        $this->assertSame(0, $lastEntries[$ana->id]['days']);

        $this->getJson('/api/v1/league?weeks_ago=99')->assertStatus(422);
    }

    public function test_private_and_blocked_friends_do_not_appear(): void
    {
        $me = $this->makeUser('Abel');
        $private = $this->makeUser('Privada');
        $blocked = $this->makeUser('Bloqueado');
        $private->update(['profile_visibility' => ProfileVisibility::Private]);
        $this->befriend($me, $private);
        $this->befriend($me, $blocked);
        UserBlock::query()->create(['blocker_id' => $blocked->id, 'blocked_id' => $me->id]);

        $this->actingAs($me)->getJson('/api/v1/league')
            ->assertOk()
            ->assertJsonCount(1, 'entries')
            ->assertJsonPath('entries.0.me', true);

        // Quien tiene el perfil privado sí se ve a sí mismo, y a su amigo.
        $this->actingAs($private)->getJson('/api/v1/league')->assertOk()->assertJsonCount(2, 'entries');
    }
}
