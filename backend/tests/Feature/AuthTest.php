<?php

namespace Tests\Feature;

use App\Models\Routine;
use App\Support\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    private array $spa = ['Referer' => 'http://localhost/', 'Accept' => 'application/json'];

    public function test_register_login_and_me(): void
    {
        $this->withHeaders($this->spa)->postJson('/api/v1/auth/register', [
            'name' => 'Abel',
            'username' => '@Abel.Fit',
            'email' => 'abel@example.com',
            'password' => 'secret-password',
            'password_confirmation' => 'secret-password',
        ])->assertCreated()->assertJsonPath('user.email', 'abel@example.com');

        // (201 en test porque el guard reutiliza el modelo recién creado.)
        $this->withHeaders($this->spa)->getJson('/api/v1/auth/me')
            ->assertSuccessful()
            ->assertJsonPath('data.email', 'abel@example.com')
            ->assertJsonPath('data.username', 'abel.fit');
    }

    public function test_login_rejects_bad_credentials(): void
    {
        $user = $this->makeUser();

        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrong',
        ])->assertStatus(422);

        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_login_is_throttled(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', [
                'email' => 'nobody@example.com',
                'password' => 'nope',
            ])->assertStatus(422);
        }

        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'nope',
        ])->assertStatus(429);
    }

    public function test_guests_cannot_use_the_api(): void
    {
        $this->getJson('/api/v1/routines')->assertUnauthorized();
        $this->getJson('/api/v1/exercise-history?routine_exercise_id=1')->assertUnauthorized();
    }

    public function test_tenant_scope_fails_closed_when_enforced_without_context(): void
    {
        TenantContext::enforce(true);
        try {
            $this->expectException(RuntimeException::class);
            Routine::query()->count();
        } finally {
            TenantContext::enforce(false);
        }
    }
}
