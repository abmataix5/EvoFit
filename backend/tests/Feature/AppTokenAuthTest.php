<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

/**
 * Las apps de iOS y Android no usan cookies: entran mandando `device_name` y reciben un token.
 */
class AppTokenAuthTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    /** Entra como lo hace la app y devuelve el token. */
    private function appLogin(string $email, string $device = 'iPhone de Ana'): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password',
            'device_name' => $device,
        ])->assertOk()->json('token');
    }

    /** Cada petición de la app llega sin estado previo: se olvida el usuario ya resuelto. */
    private function asApp(string $token): static
    {
        Auth::forgetGuards();

        return $this->withToken($token);
    }

    public function test_app_logs_in_with_a_token_and_uses_the_api(): void
    {
        $user = $this->makeUser();
        $token = $this->appLogin($user->email);

        $this->assertNotEmpty($token);
        $this->assertGuest('web');

        $this->asApp($token)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->asApp($token)->getJson('/api/v1/routines')->assertOk();
    }

    public function test_app_login_rejects_bad_credentials(): void
    {
        $user = $this->makeUser();

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'wrong', 'device_name' => 'iPhone',
        ])->assertStatus(422)->assertJsonMissingPath('token');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_app_registers_and_gets_a_token(): void
    {
        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Ana', 'username' => 'ana.app', 'email' => 'ana@example.com',
            'password' => 'secret-password', 'password_confirmation' => 'secret-password',
            'terms' => true, 'device_name' => 'Pixel de Ana',
        ])->assertCreated()->json('token');

        $this->asApp($token)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.email', 'ana@example.com');
    }

    public function test_web_login_does_not_return_a_token(): void
    {
        $user = $this->makeUser();

        $this->withHeaders(['Referer' => 'http://localhost/', 'Accept' => 'application/json'])
            ->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()->assertJsonMissingPath('token');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_app_logout_only_revokes_that_device(): void
    {
        $user = $this->makeUser();
        $phone = $this->appLogin($user->email, 'iPhone');
        $tablet = $this->appLogin($user->email, 'iPad');

        $this->asApp($phone)->postJson('/api/v1/auth/logout')->assertOk();

        $this->asApp($phone)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->asApp($tablet)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_changing_the_password_from_the_app_signs_out_other_devices(): void
    {
        $user = $this->makeUser();
        $phone = $this->appLogin($user->email, 'iPhone');
        $tablet = $this->appLogin($user->email, 'iPad');

        $this->asApp($phone)->putJson('/api/v1/profile/password', [
            'current_password' => 'password',
            'password' => 'another-secret-1', 'password_confirmation' => 'another-secret-1',
        ])->assertOk();

        $this->asApp($phone)->getJson('/api/v1/auth/me')->assertOk();
        $this->asApp($tablet)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_app_can_delete_the_account_and_its_tokens(): void
    {
        $user = $this->makeUser();
        $token = $this->appLogin($user->email);

        $this->asApp($token)->deleteJson('/api/v1/profile', ['current_password' => 'wrong'])->assertStatus(422);
        $this->asApp($token)->deleteJson('/api/v1/profile', ['current_password' => 'password'])->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_the_apps_origins_are_allowed_by_cors(): void
    {
        foreach (['capacitor://localhost', 'https://localhost'] as $origin) {
            $this->withHeaders(['Origin' => $origin])->getJson('/api/v1/pricing')
                ->assertOk()->assertHeader('Access-Control-Allow-Origin', $origin);
        }
    }
}
