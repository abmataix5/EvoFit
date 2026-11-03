<?php

namespace Tests\Feature;

use App\Models\BodyWeightEntry;
use App\Models\ProgressPhoto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class ProgressTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    public function test_photos_are_private_and_served_through_the_api(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $user = $this->makeUser();

        $response = $this->actingAs($user)->post('/api/v1/progress/photos', [
            'recorded_on' => '2026-11-01',
            'photo' => UploadedFile::fake()->image('front.jpg', 20, 20),
        ], ['Accept' => 'application/json'])->assertCreated();

        $id = $response->json('photo.id');
        $response->assertJsonPath('photo.url', "/api/v1/progress/photos/{$id}/image");

        $photo = ProgressPhoto::query()->findOrFail($id);
        $this->assertSame('local', $photo->disk);
        Storage::disk('local')->assertExists($photo->path);
        $this->assertSame([], Storage::disk('public')->allFiles());

        $image = $this->get("/api/v1/progress/photos/{$id}/image")->assertOk();
        $this->assertSame('image/jpeg', $image->headers->get('Content-Type'));
        $this->assertStringContainsString('private', $image->headers->get('Cache-Control'));
        $this->assertStringContainsString('max-age=86400', $image->headers->get('Cache-Control'));

        $this->deleteJson("/api/v1/progress/photos/{$id}")->assertOk();
        Storage::disk('local')->assertMissing($photo->path);
        $this->assertNull(ProgressPhoto::query()->find($id));
    }

    public function test_delete_body_weight(): void
    {
        $user = $this->makeUser();
        $entry = BodyWeightEntry::query()->create([
            'tenant_id' => $user->tenant_id, 'user_id' => $user->id, 'recorded_on' => '2026-11-01', 'weight_kg' => 81.2,
        ]);

        $this->actingAs($user)->deleteJson("/api/v1/progress/body-weight/{$entry->id}")->assertOk();
        $this->assertNull(BodyWeightEntry::query()->find($entry->id));
        $this->deleteJson("/api/v1/progress/body-weight/{$entry->id}")->assertNotFound();
    }

    public function test_command_moves_public_photos_to_private_idempotently(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $user = $this->makeUser();
        Storage::disk('public')->put('progress/1/1/a.jpg', 'jpeg-bytes');

        $photo = ProgressPhoto::query()->create([
            'tenant_id' => $user->tenant_id, 'user_id' => $user->id, 'recorded_on' => '2026-10-01',
            'disk' => 'public', 'path' => 'progress/1/1/a.jpg',
        ]);
        $missing = ProgressPhoto::query()->create([
            'tenant_id' => $user->tenant_id, 'user_id' => $user->id, 'recorded_on' => '2026-10-02',
            'disk' => 'public', 'path' => 'progress/1/1/missing.jpg',
        ]);

        $this->artisan('photos:make-private')->assertSuccessful();
        $this->artisan('photos:make-private')->assertSuccessful();

        $this->assertSame('local', $photo->fresh()->disk);
        $this->assertSame('jpeg-bytes', Storage::disk('local')->get('progress/1/1/a.jpg'));
        Storage::disk('public')->assertMissing('progress/1/1/a.jpg');
        $this->assertSame('public', $missing->fresh()->disk);
    }
}
