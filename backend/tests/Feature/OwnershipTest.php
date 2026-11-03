<?php

namespace Tests\Feature;

use App\Models\BodyWeightEntry;
use App\Models\ProgressPhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class OwnershipTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    /**
     * Otro tenant: el scope global hace que ni siquiera exista (404).
     */
    public function test_user_cannot_touch_another_tenants_data(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser('Alice');
        $bob = $this->makeUser('Bob');
        [$routine, $day, $exercises] = $this->makeRoutine($bob);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());
        $catalogId = $exercises['Press banca']->catalog_exercise_id;
        $weight = BodyWeightEntry::query()->create(['tenant_id' => $bob->tenant_id, 'user_id' => $bob->id, 'recorded_on' => '2026-10-01', 'weight_kg' => 80]);
        $photo = $this->makePhoto($bob);

        $this->actingAs($alice);
        $forbidden = fn ($response) => $this->assertContains($response->status(), [403, 404], $response->getContent());

        $forbidden($this->getJson("/api/v1/routines/{$routine->id}"));
        $forbidden($this->patchJson("/api/v1/routines/{$routine->id}", ['name' => 'Hack']));
        $forbidden($this->deleteJson("/api/v1/routines/{$routine->id}"));
        $forbidden($this->getJson("/api/v1/routines/{$routine->id}/history"));
        $forbidden($this->getJson("/api/v1/workout-sessions/{$session->id}"));
        $forbidden($this->patchJson("/api/v1/workout-sessions/{$session->id}", ['notes' => 'x']));
        $forbidden($this->putJson("/api/v1/workout-sessions/{$session->id}/logs", ['sets' => []]));
        $forbidden($this->patchJson("/api/v1/catalog-exercises/{$catalogId}", ['notes' => 'x']));
        $forbidden($this->deleteJson("/api/v1/catalog-exercises/{$catalogId}"));
        $forbidden($this->deleteJson("/api/v1/progress/body-weight/{$weight->id}"));
        $forbidden($this->getJson("/api/v1/progress/photos/{$photo->id}/image"));
        $forbidden($this->deleteJson("/api/v1/progress/photos/{$photo->id}"));
        $forbidden($this->getJson('/api/v1/exercise-history?routine_exercise_id='.$exercises['Press banca']->id));

        $this->getJson('/api/v1/routines')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/progress/photos')->assertOk()->assertJsonCount(0, 'data');

        $this->assertSame('Rutina de Bob', $routine->fresh()->name);
        $this->assertNull($session->fresh()->notes);
        $this->assertNotNull($weight->fresh());
        $this->assertNotNull($photo->fresh());
        Storage::disk('local')->assertExists($photo->path);
    }

    /**
     * Mismo tenant, otro usuario: lo frenan las policies (403).
     */
    public function test_policies_block_other_users_in_the_same_tenant(): void
    {
        Storage::fake('local');
        $owner = $this->makeUser('Owner');
        $mate = User::factory()->create(['tenant_id' => $owner->tenant_id, 'role' => 'member']);
        [$routine, $day] = $this->makeRoutine($owner);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());
        $weight = BodyWeightEntry::query()->create(['tenant_id' => $owner->tenant_id, 'user_id' => $owner->id, 'recorded_on' => '2026-10-01', 'weight_kg' => 80]);
        $photo = $this->makePhoto($owner);

        $this->actingAs($mate);

        $this->getJson("/api/v1/routines/{$routine->id}")->assertForbidden();
        $this->patchJson("/api/v1/routines/{$routine->id}", ['name' => 'Hack'])->assertForbidden();
        $this->deleteJson("/api/v1/routines/{$routine->id}")->assertForbidden();
        $this->getJson("/api/v1/workout-sessions/{$session->id}")->assertForbidden();
        $this->putJson("/api/v1/workout-sessions/{$session->id}/logs", ['sets' => []])->assertForbidden();
        $this->deleteJson("/api/v1/progress/body-weight/{$weight->id}")->assertForbidden();
        $this->getJson("/api/v1/progress/photos/{$photo->id}/image")->assertForbidden();
        $this->deleteJson("/api/v1/progress/photos/{$photo->id}")->assertForbidden();
    }

    private function makePhoto(User $user): ProgressPhoto
    {
        $path = UploadedFile::fake()->image('p.jpg')->store("progress/{$user->tenant_id}/{$user->id}", 'local');

        return ProgressPhoto::query()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'recorded_on' => '2026-10-01',
            'disk' => 'local',
            'path' => $path,
        ]);
    }
}
