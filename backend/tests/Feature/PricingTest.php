<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\PricingController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class PricingTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    public function test_guests_see_how_many_free_spots_are_left(): void
    {
        $this->makeUser('Ana');
        $this->makeUser('Luis');

        $this->getJson('/api/v1/pricing')
            ->assertOk()
            ->assertExactJson([
                'founder_spots' => PricingController::FOUNDER_SPOTS,
                'founder_spots_left' => PricingController::FOUNDER_SPOTS - 2,
            ]);
    }

    public function test_free_spots_never_go_below_zero(): void
    {
        $tenantId = $this->makeUser()->tenant_id;
        User::factory()->count(PricingController::FOUNDER_SPOTS + 5)->create(['tenant_id' => $tenantId]);

        $this->getJson('/api/v1/pricing')->assertOk()->assertJsonPath('founder_spots_left', 0);
    }
}
