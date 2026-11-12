<?php

namespace Tests\Feature;

use App\Mail\FriendRequestMail;
use App\Models\Friendship;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class SocialTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutDefer();
        Mail::fake();
    }

    private function befriend(User $a, User $b): void
    {
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => 'accepted', 'accepted_at' => now()]);
    }

    public function test_search_finds_by_username_and_name_and_hides_self(): void
    {
        $me = $this->makeUser('Abel');
        $ana = $this->makeUser('Ana García');
        $ana->update(['username' => 'ana.fit']);
        $this->makeUser('Luis');

        $this->actingAs($me)->getJson('/api/v1/people/search?q=@ana')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.username', 'ana.fit')->assertJsonPath('data.0.relation', 'none');
        $this->actingAs($me)->getJson('/api/v1/people/search?q=garc')->assertJsonPath('data.0.id', $ana->id);
        $this->actingAs($me)->getJson('/api/v1/people/search?q=abel')->assertJsonCount(0, 'data');
        $this->actingAs($me)->getJson('/api/v1/people/search?q=a')->assertJsonValidationErrors('q');
    }

    public function test_friend_request_flow_with_notifications_and_email(): void
    {
        $abel = $this->makeUser('Abel');
        $ana = $this->makeUser('Ana');

        $this->actingAs($abel)->postJson('/api/v1/friend-requests', ['user_id' => $ana->id])
            ->assertCreated()->assertJsonPath('data.relation', 'outgoing');

        Mail::assertSent(FriendRequestMail::class, fn (FriendRequestMail $mail) => $mail->hasTo($ana->email) && $mail->sender->is($abel));

        $notifications = $this->actingAs($ana)->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonPath('data.0.kind', 'friend_request')
            ->assertJsonPath('data.0.actor.id', $abel->id)
            ->assertJsonPath('data.0.pending', true);
        $friendshipId = $notifications->json('data.0.friendship_id');

        $this->actingAs($ana)->getJson('/api/v1/friend-requests')
            ->assertJsonPath('incoming.0.user.id', $abel->id)->assertJsonCount(0, 'outgoing');

        $this->actingAs($ana)->postJson("/api/v1/friend-requests/{$friendshipId}/accept")
            ->assertOk()->assertJsonPath('data.relation', 'friends');

        // La solicitud queda leída y sin botones; Abel recibe el aviso de aceptación.
        $this->actingAs($ana)->getJson('/api/v1/notifications')->assertJsonPath('unread', 0)->assertJsonPath('data.0.pending', false);
        $this->actingAs($abel)->getJson('/api/v1/notifications')->assertJsonPath('data.0.kind', 'friend_accepted');

        $this->actingAs($abel)->getJson('/api/v1/friends')->assertJsonPath('data.0.id', $ana->id);
        $this->actingAs($ana)->getJson('/api/v1/friends')->assertJsonPath('data.0.id', $abel->id);
    }

    public function test_mutual_requests_become_friendship(): void
    {
        $abel = $this->makeUser('Abel');
        $ana = $this->makeUser('Ana');

        $this->actingAs($abel)->postJson('/api/v1/friend-requests', ['user_id' => $ana->id]);
        $this->actingAs($ana)->postJson('/api/v1/friend-requests', ['user_id' => $abel->id])
            ->assertJsonPath('data.relation', 'friends');

        $this->assertSame(1, Friendship::query()->count());
    }

    public function test_no_email_when_disabled_and_unsubscribe_link_works(): void
    {
        $abel = $this->makeUser('Abel');
        $ana = $this->makeUser('Ana');
        $ana->update(['email_notifications' => false]);

        $this->actingAs($abel)->postJson('/api/v1/friend-requests', ['user_id' => $ana->id])->assertCreated();
        Mail::assertNothingSent();

        $luis = $this->makeUser('Luis');
        $this->get('/api/v1/email/unsubscribe/'.$luis->id)->assertForbidden();
        $this->get(URL::signedRoute('email.unsubscribe', ['user' => $luis->id]))->assertOk()->assertSee('no te enviaremos');
        $this->assertFalse($luis->refresh()->email_notifications);
    }

    public function test_decline_cancel_and_unfriend(): void
    {
        $abel = $this->makeUser('Abel');
        $ana = $this->makeUser('Ana');

        $id = $this->actingAs($abel)->postJson('/api/v1/friend-requests', ['user_id' => $ana->id])->json('data.friendship_id');
        $this->actingAs($ana)->deleteJson("/api/v1/friend-requests/{$id}")->assertOk()->assertJsonPath('data.relation', 'none');

        $id = $this->actingAs($abel)->postJson('/api/v1/friend-requests', ['user_id' => $ana->id])->json('data.friendship_id');
        // Solo quien la recibe puede aceptarla.
        $this->actingAs($abel)->postJson("/api/v1/friend-requests/{$id}/accept")->assertForbidden();
        $this->actingAs($abel)->deleteJson("/api/v1/friend-requests/{$id}")->assertOk();

        $this->befriend($abel, $ana);
        $this->actingAs($ana)->deleteJson("/api/v1/friends/{$abel->id}")->assertOk()->assertJsonPath('data.relation', 'none');
        $this->assertSame(0, Friendship::query()->count());
    }

    public function test_strangers_cannot_touch_others_requests(): void
    {
        [$abel, $ana, $intruder] = [$this->makeUser('Abel'), $this->makeUser('Ana'), $this->makeUser('Intruso')];
        $id = $this->actingAs($abel)->postJson('/api/v1/friend-requests', ['user_id' => $ana->id])->json('data.friendship_id');

        $this->actingAs($intruder)->postJson("/api/v1/friend-requests/{$id}/accept")->assertForbidden();
        $this->actingAs($intruder)->deleteJson("/api/v1/friend-requests/{$id}")->assertNotFound();
    }

    public function test_profile_visibility_rules(): void
    {
        $viewer = $this->makeUser('Viewer');
        $owner = $this->makeUser('Owner');
        [, $day, $exercises] = $this->makeRoutine($owner);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());
        $this->logSet($session, $exercises['Press banca'], 1, 80, 5);
        $owner->update(['birth_date' => now()->subYears(30)->subDay(), 'show_age' => false]);

        // "Solo amigos" (por defecto): sin ser amigos no hay estadísticas.
        $this->actingAs($viewer)->getJson("/api/v1/people/{$owner->id}")
            ->assertOk()->assertJsonPath('data.can_view_activity', false)->assertJsonPath('data.stats', null)->assertJsonPath('data.age', null);
        $this->actingAs($viewer)->getJson("/api/v1/people/{$owner->id}/friends")->assertForbidden();

        $this->befriend($viewer, $owner);
        // Las estadísticas son las del dueño aunque las pida otro usuario (otro tenant).
        $this->actingAs($viewer)->getJson("/api/v1/people/{$owner->id}")
            ->assertJsonPath('data.relation', 'friends')->assertJsonPath('data.stats.total_workouts', 1)->assertJsonPath('data.friends_count', 1)
            ->assertJsonPath('data.posts_count', 0);

        $owner->update(['profile_visibility' => 'private']);
        $this->actingAs($viewer)->getJson("/api/v1/people/{$owner->id}")->assertJsonPath('data.stats', null);

        $owner->update(['profile_visibility' => 'public']);
        $stranger = $this->makeUser('Stranger');
        $this->actingAs($stranger)->getJson("/api/v1/people/{$owner->id}")->assertJsonPath('data.can_view_activity', true);
    }

    public function test_blocking_hides_users_and_removes_friendship(): void
    {
        $abel = $this->makeUser('Abel');
        $troll = $this->makeUser('Troll');
        $this->befriend($abel, $troll);

        $this->actingAs($abel)->postJson("/api/v1/people/{$troll->id}/block")->assertOk()->assertJsonPath('data.blocked_by_me', true);
        $this->assertSame(0, Friendship::query()->count());

        $this->actingAs($troll)->getJson("/api/v1/people/{$abel->id}")->assertNotFound();
        $this->actingAs($troll)->getJson('/api/v1/people/search?q=abel')->assertJsonCount(0, 'data');
        $this->actingAs($troll)->postJson('/api/v1/friend-requests', ['user_id' => $abel->id])->assertNotFound();
        $this->actingAs($abel)->getJson('/api/v1/people/search?q=troll')->assertJsonCount(0, 'data');

        $this->actingAs($abel)->deleteJson("/api/v1/people/{$troll->id}/block")->assertOk()->assertJsonPath('data.blocked_by_me', false);
        $this->actingAs($troll)->getJson("/api/v1/people/{$abel->id}")->assertOk();
    }

    public function test_report_user(): void
    {
        $abel = $this->makeUser('Abel');
        $troll = $this->makeUser('Troll');

        $this->actingAs($abel)->postJson("/api/v1/people/{$troll->id}/report", ['reason' => 'nonsense'])->assertJsonValidationErrors('reason');
        $this->actingAs($abel)->postJson("/api/v1/people/{$troll->id}/report", ['reason' => 'spam', 'details' => 'Publicidad'])->assertCreated();
        $this->assertDatabaseHas('user_reports', ['reporter_id' => $abel->id, 'reported_user_id' => $troll->id, 'reason' => 'spam']);
    }

    public function test_cannot_befriend_self_and_mark_all_read(): void
    {
        $abel = $this->makeUser('Abel');
        $ana = $this->makeUser('Ana');
        $this->actingAs($abel)->postJson('/api/v1/friend-requests', ['user_id' => $abel->id])->assertJsonValidationErrors('user_id');

        $this->actingAs($ana)->postJson('/api/v1/friend-requests', ['user_id' => $abel->id]);
        $this->actingAs($abel)->getJson('/api/v1/notifications/unread-count')->assertJsonPath('unread', 1);
        $this->actingAs($abel)->postJson('/api/v1/notifications/read-all')->assertJsonPath('unread', 0);
        $this->actingAs($abel)->getJson('/api/v1/notifications/unread-count')->assertJsonPath('unread', 0);

        // Borrar avisos: uno suelto (solo los propios) o la bandeja entera.
        $id = $abel->notifications()->first()->id;
        $this->actingAs($this->makeUser('Otra'))->deleteJson("/api/v1/notifications/{$id}")->assertOk();
        $this->assertSame(1, $abel->notifications()->count());
        $this->actingAs($abel)->deleteJson("/api/v1/notifications/{$id}")->assertOk()->assertJsonPath('unread', 0);
        $this->assertSame(0, $abel->notifications()->count());
        $this->deleteJson('/api/v1/notifications')->assertOk()->assertJsonPath('unread', 0);
    }

    public function test_email_notifications_preference_is_editable(): void
    {
        $abel = $this->makeUser('Abel');
        $this->actingAs($abel)->patchJson('/api/v1/profile', ['email_notifications' => false])
            ->assertOk()->assertJsonPath('data.email_notifications', false);
    }

    public function test_friend_request_email_renders(): void
    {
        $abel = $this->makeUser('Abel');
        $abel->update(['username' => 'abel']);
        $ana = $this->makeUser('Ana');

        $mail = new FriendRequestMail($abel, $ana);
        $mail->assertSeeInHtml('Abel quiere ser tu amigo');
        $mail->assertSeeInHtml('@abel');
        $mail->assertSeeInHtml('/notifications');
        $mail->assertSeeInText('No quiero recibir más avisos');
        $this->assertSame('Abel quiere ser tu amigo en EvoFit', $mail->envelope()->subject);
    }
}
