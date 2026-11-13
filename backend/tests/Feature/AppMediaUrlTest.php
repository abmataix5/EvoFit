<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

/**
 * Las apps de iOS y Android no pueden mandar su token al cargar una imagen: el servidor les da
 * direcciones firmadas. La web sigue recibiendo la ruta de siempre.
 */
class AppMediaUrlTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    private array $spa = ['Referer' => 'http://localhost/', 'Accept' => 'application/json'];

    /** Como una petición nueva y sin sesión: se olvida el usuario ya resuelto. */
    private function fresh(): static
    {
        Auth::forgetGuards();
        $this->app['auth']->shouldUse('web');

        return $this->flushHeaders();
    }

    private function path(string $url): string
    {
        return parse_url($url, PHP_URL_PATH).'?'.parse_url($url, PHP_URL_QUERY);
    }

    public function test_app_gets_a_signed_avatar_url_that_loads_without_a_token(): void
    {
        Storage::fake('local');
        $user = $this->makeUser();
        $webUrl = $this->actingAs($user)->post('/api/v1/profile/avatar', [
            'avatar' => UploadedFile::fake()->image('me.png', 400, 400),
        ], $this->spa)->assertOk()->json('data.avatar_url');

        // La web recibe la ruta de siempre, sin firma.
        $this->assertStringStartsWith("/api/v1/users/{$user->id}/avatar?v=", $webUrl);
        $this->assertStringNotContainsString('signature', $webUrl);

        $token = $this->fresh()->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'password', 'device_name' => 'iPhone',
        ])->assertOk()->json('token');
        $appUrl = $this->fresh()->withToken($token)->getJson('/api/v1/auth/me')->assertOk()->json('data.avatar_url');

        // La app recibe la dirección completa y firmada…
        $this->assertStringStartsWith(rtrim(config('app.url'), '/')."/api/v1/users/{$user->id}/avatar?", $appUrl);
        $this->assertStringContainsString('signature=', $appUrl);

        // …que carga sin token ni cookie,
        $this->fresh()->get($this->path($appUrl))->assertOk();
        // no vale si se toca,
        $this->fresh()->getJson(str_replace("users/{$user->id}/", 'users/'.($user->id + 1).'/', $this->path($appUrl)))->assertUnauthorized();
        $this->fresh()->getJson($this->path($appUrl).'0')->assertUnauthorized();
        // ni cuando caduca.
        $this->travel(15)->days();
        $this->fresh()->getJson($this->path($appUrl))->assertUnauthorized();
    }

    public function test_images_still_need_a_session_without_a_signature(): void
    {
        $user = $this->makeUser();

        $this->getJson("/api/v1/users/{$user->id}/avatar")->assertUnauthorized();
    }

    public function test_a_signed_url_keeps_the_permissions_of_who_it_was_signed_for(): void
    {
        Storage::fake('local');
        $owner = $this->makeUser('Ana');
        $other = $this->makeUser('Luis');
        $photoId = $this->actingAs($owner)->post('/api/v1/progress/photos', [
            'recorded_on' => '2026-11-01',
            'photo' => UploadedFile::fake()->image('front.jpg', 600, 800),
        ], $this->spa)->assertSuccessful()->json('photo.id');

        // Una firma hecha para otra persona no abre una foto privada.
        Auth::forgetGuards();
        $forOther = \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'media.progress', now()->addDay(), ['progressPhoto' => $photoId, 'viewer' => $other->id], absolute: false,
        );
        $this->fresh()->getJson($forOther)->assertStatus(404);

        $forOwner = \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'media.progress', now()->addDay(), ['progressPhoto' => $photoId, 'viewer' => $owner->id], absolute: false,
        );
        $this->fresh()->get($forOwner)->assertOk();
    }
}
