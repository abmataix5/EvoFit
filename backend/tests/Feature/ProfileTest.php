<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    private array $spa = ['Referer' => 'http://localhost/', 'Accept' => 'application/json'];

    public function test_profile_can_be_updated_and_is_returned_by_me(): void
    {
        $user = $this->makeUser('Abel');

        $this->actingAs($user)->patchJson('/api/v1/profile', [
            'username' => '@Abel.Mataix',
            'bio' => '  Powerlifter amateur  ',
            'location' => 'Valencia, España',
            'birth_date' => now()->subYears(30)->subDay()->toDateString(),
            'height_cm' => 178,
            'gym_name' => 'Basic Fit',
            'experience_level' => 'intermediate',
            'training_goal' => 'strength',
            'profile_visibility' => 'public',
            'show_age' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.username', 'abel.mataix')
            ->assertJsonPath('data.bio', 'Powerlifter amateur')
            ->assertJsonPath('data.age', 30)
            ->assertJsonPath('data.experience_level', 'intermediate')
            ->assertJsonPath('data.profile_visibility', 'public')
            ->assertJsonPath('data.show_age', false);

        $this->actingAs($user)->getJson('/api/v1/auth/me')
            ->assertJsonPath('data.location', 'Valencia, España')
            ->assertJsonPath('data.height_cm', 178);
    }

    public function test_empty_strings_clear_optional_fields(): void
    {
        $user = $this->makeUser();
        $user->update(['bio' => 'algo', 'location' => 'Madrid']);

        $this->actingAs($user)->patchJson('/api/v1/profile', ['bio' => '', 'location' => '   '])
            ->assertOk()
            ->assertJsonPath('data.bio', null)
            ->assertJsonPath('data.location', null);
    }

    public function test_profile_validation(): void
    {
        $user = $this->makeUser('Ana');
        $other = $this->makeUser('Luis');
        $other->update(['username' => 'luis']);

        $this->actingAs($user)->patchJson('/api/v1/profile', [
            'username' => 'LUIS',
            'birth_date' => now()->subYears(5)->toDateString(),
            'height_cm' => 20,
            'experience_level' => 'god',
            'profile_visibility' => 'everyone',
            'bio' => str_repeat('a', 281),
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'username', 'birth_date', 'height_cm', 'experience_level', 'profile_visibility', 'bio',
        ]);

        $this->actingAs($user)->patchJson('/api/v1/profile', ['username' => '.ana'])
            ->assertJsonValidationErrors('username');
        $this->actingAs($user)->patchJson('/api/v1/profile', ['name' => ''])
            ->assertJsonValidationErrors('name');
    }

    public function test_profile_cannot_change_protected_fields(): void
    {
        $user = $this->makeUser();
        $other = $this->makeUser('Otro');

        $this->actingAs($user)->patchJson('/api/v1/profile', [
            'tenant_id' => $other->tenant_id,
            'role' => 'admin',
            'email' => 'hack@example.com',
            'avatar_path' => '../../.env',
        ])->assertOk();

        $user->refresh();
        $this->assertNotSame($other->tenant_id, $user->tenant_id);
        $this->assertSame('owner', $user->role);
        $this->assertNotSame('hack@example.com', $user->email);
        $this->assertNull($user->avatar_path);
    }

    public function test_avatar_upload_is_reencoded_square_and_replaces_previous(): void
    {
        Storage::fake('local');
        $user = $this->makeUser();

        $first = $this->actingAs($user)->post('/api/v1/profile/avatar', [
            'avatar' => UploadedFile::fake()->image('me.png', 900, 600),
        ], $this->spa)->assertOk()->json('data.avatar_url');

        $this->assertNotNull($first);
        $firstPath = $user->refresh()->avatar_path;
        Storage::disk('local')->assertExists($firstPath);

        [$w, $h, $type] = getimagesizefromstring(Storage::disk('local')->get($firstPath));
        $this->assertSame([512, 512, IMAGETYPE_JPEG], [$w, $h, $type]);

        $this->travel(2)->seconds();
        $second = $this->actingAs($user)->post('/api/v1/profile/avatar', [
            'avatar' => UploadedFile::fake()->image('me2.jpg', 300, 300),
        ], $this->spa)->assertOk()->json('data.avatar_url');

        $this->assertNotSame($first, $second);
        Storage::disk('local')->assertMissing($firstPath);
        Storage::disk('local')->assertExists($user->refresh()->avatar_path);
    }

    public function test_avatar_rejects_non_images(): void
    {
        Storage::fake('local');
        $user = $this->makeUser();

        $this->actingAs($user)->post('/api/v1/profile/avatar', [
            'avatar' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
        ], $this->spa)->assertUnprocessable()->assertJsonValidationErrors('avatar');
    }

    public function test_avatar_is_served_to_other_users_and_can_be_removed(): void
    {
        Storage::fake('local');
        $user = $this->makeUser('Ana');
        $viewer = $this->makeUser('Luis');

        $this->actingAs($user)->post('/api/v1/profile/avatar', [
            'avatar' => UploadedFile::fake()->image('me.jpg', 200, 200),
        ], $this->spa)->assertOk();
        $path = $user->refresh()->avatar_path;

        $this->actingAs($viewer)->get('/api/v1/users/'.$user->id.'/avatar')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg');

        $this->actingAs($user)->deleteJson('/api/v1/profile/avatar')
            ->assertOk()
            ->assertJsonPath('data.avatar_url', null);
        Storage::disk('local')->assertMissing($path);

        $this->actingAs($viewer)->get('/api/v1/users/'.$user->id.'/avatar')->assertNotFound();
    }

    public function test_avatar_requires_authentication(): void
    {
        $user = $this->makeUser();

        $this->getJson('/api/v1/users/'.$user->id.'/avatar')->assertUnauthorized();
        $this->patchJson('/api/v1/profile', ['bio' => 'x'])->assertUnauthorized();
    }

    public function test_password_change_requires_current_password(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->putJson('/api/v1/profile/password', [
            'current_password' => 'wrong',
            'password' => 'new-secret-password',
            'password_confirmation' => 'new-secret-password',
        ])->assertJsonValidationErrors('current_password');

        $this->actingAs($user)->putJson('/api/v1/profile/password', [
            'current_password' => 'password',
            'password' => 'new-secret-password',
            'password_confirmation' => 'new-secret-password',
        ], $this->spa)->assertOk();

        // La sesión actual sigue valiendo tras cambiar la contraseña.
        $this->withHeaders($this->spa)->getJson('/api/v1/auth/me')->assertOk();

        $this->assertTrue(Hash::check('new-secret-password', $user->refresh()->password));
    }

    public function test_profile_stats(): void
    {
        $user = $this->makeUser();
        [, $day, $exercises] = $this->makeRoutine($user);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());
        $this->logSet($session, $exercises['Press banca'], 1, 80, 5);

        $this->actingAs($user)->getJson('/api/v1/profile/stats')
            ->assertOk()
            ->assertJsonPath('total_workouts', 1)
            ->assertJsonPath('streak_weeks', 1)
            ->assertJsonPath('first_workout_on', now()->toDateString());
    }

    public function test_deleting_user_removes_avatar_file(): void
    {
        Storage::fake('local');
        $user = $this->makeUser();
        Storage::disk('local')->put('avatars/'.$user->id.'/a.jpg', 'x');
        $user->forceFill(['avatar_path' => 'avatars/'.$user->id.'/a.jpg'])->save();

        User::query()->whereKey($user->id)->first()->delete();

        Storage::disk('local')->assertMissing('avatars/'.$user->id.'/a.jpg');
    }
}
