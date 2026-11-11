<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Story;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class StoriesAndMessagesTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    private function befriend(User $a, User $b): void
    {
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => 'accepted', 'accepted_at' => now()]);
    }

    private function postStory(User $user, array $data = []): TestResponse
    {
        return $this->actingAs($user)->post('/api/v1/stories', $data + ['background' => 'energy'], ['Accept' => 'application/json']);
    }

    public function test_story_with_fitness_stickers_resolved_on_server(): void
    {
        $ana = $this->makeUser('Ana');
        $ana->update(['gym_name' => 'Basic Fit']);
        [, $day, $exercises] = $this->makeRoutine($ana, ['Sentadilla' => []], (int) now()->isoWeekday());
        $day->update(['name' => 'Pierna']);
        $session = $this->makeSession($day, now()->toDateString(), now()->toDateTimeString());
        $this->logSet($session, $exercises['Sentadilla'], 1, 100, 5);

        $this->actingAs($ana)->getJson('/api/v1/stories/stickers')
            ->assertJsonPath('data.today', 'Pierna')->assertJsonPath('data.gym', 'Basic Fit')->assertJsonPath('data.streak', 1);

        $this->postStory($ana, ['text' => 'Día de pierna 🦵', 'gym' => 'Basic Fit', 'show_today' => true, 'show_streak' => true])
            ->assertCreated()
            ->assertJsonPath('data.stickers.today', 'Pierna')
            ->assertJsonPath('data.stickers.streak', 1)
            ->assertJsonPath('data.stickers.gym', 'Basic Fit')
            ->assertJsonPath('data.background', 'energy');

        // Sin activar los stickers no salen.
        $this->postStory($ana)->assertJsonPath('data.stickers.today', null)->assertJsonPath('data.stickers.streak', null);
        $this->postStory($ana, ['background' => null])->assertJsonValidationErrors('photo');
    }

    public function test_story_bar_visibility_order_and_views(): void
    {
        Storage::fake('local');
        $me = $this->makeUser('Yo');
        $ana = $this->makeUser('Ana');
        $luis = $this->makeUser('Luis');
        $stranger = $this->makeUser('Extraño');
        $this->befriend($me, $ana);
        $this->befriend($me, $luis);

        $anaStory = $this->postStory($ana, ['photo' => UploadedFile::fake()->image('a.jpg', 1080, 1920)])->json('data.id');
        $luisStory = $this->postStory($luis)->json('data.id');
        $this->postStory($stranger);
        $this->postStory($me);

        // Veo la de Ana: pasa al final (ya vista); la mía siempre primero.
        $this->actingAs($me)->postJson("/api/v1/stories/{$anaStory}/view")->assertOk();
        $this->actingAs($me)->postJson("/api/v1/stories/{$anaStory}/view")->assertOk();
        $bar = $this->actingAs($me)->getJson('/api/v1/stories')->assertOk()->json('data');
        $this->assertSame(['Yo', 'Luis', 'Ana'], array_column(array_column($bar, 'user'), 'name'));
        $this->assertFalse($bar[2]['has_unseen']);

        $this->actingAs($ana)->getJson("/api/v1/stories/{$anaStory}/viewers")->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Yo');
        $this->actingAs($me)->getJson("/api/v1/stories/{$anaStory}/viewers")->assertNotFound();

        $this->actingAs($me)->get("/api/v1/stories/{$anaStory}/photo")->assertOk();
        $this->actingAs($stranger)->get("/api/v1/stories/{$anaStory}/photo")->assertNotFound();
        $this->actingAs($stranger)->postJson("/api/v1/stories/{$luisStory}/view")->assertNotFound();
    }

    public function test_stories_expire_and_are_pruned_with_their_photo(): void
    {
        Storage::fake('local');
        $ana = $this->makeUser('Ana');
        $friend = $this->makeUser('Amigo');
        $this->befriend($ana, $friend);
        $id = $this->postStory($ana, ['photo' => UploadedFile::fake()->image('a.jpg', 800, 800)])->json('data.id');
        $path = Story::query()->find($id)->photo_path;

        $this->travel(Story::LIFETIME_HOURS + 1)->hours();
        $this->actingAs($friend)->getJson('/api/v1/stories')->assertJsonCount(0, 'data');
        $this->actingAs($friend)->get("/api/v1/stories/{$id}/photo")->assertNotFound();

        $this->artisan('stories:prune')->assertSuccessful();
        $this->assertNull(Story::query()->find($id));
        Storage::disk('local')->assertMissing($path);
    }

    public function test_reply_and_react_to_story_create_private_messages(): void
    {
        $ana = $this->makeUser('Ana');
        $me = $this->makeUser('Yo');
        $this->befriend($me, $ana);
        $story = $this->postStory($ana, ['text' => 'Hoy pierna'])->json('data.id');

        $conversation = $this->actingAs($me)->postJson("/api/v1/stories/{$story}/reply", ['reaction' => '🔥'])->assertCreated()->json('conversation_id');
        $this->actingAs($me)->postJson("/api/v1/stories/{$story}/reply", ['body' => '¡A tope!'])->assertCreated();
        $this->actingAs($me)->postJson("/api/v1/stories/{$story}/reply", ['reaction' => '🍕'])->assertJsonValidationErrors('reaction');
        $this->actingAs($ana)->postJson("/api/v1/stories/{$story}/reply", ['body' => 'yo'])->assertStatus(422);

        $this->actingAs($ana)->getJson('/api/v1/conversations/unread-count')->assertJsonPath('unread', 1);
        $this->actingAs($ana)->getJson('/api/v1/conversations')
            ->assertJsonPath('data.0.user.name', 'Yo')
            ->assertJsonPath('data.0.unread', 2)
            ->assertJsonPath('data.0.last_message.preview', 'Ha respondido a tu historia: ¡A tope!');

        $this->actingAs($ana)->getJson("/api/v1/conversations/{$conversation}/messages")
            ->assertJsonPath('data.0.reaction', '🔥')
            ->assertJsonPath('data.0.story_reply', true)
            ->assertJsonPath('data.0.story.text', 'Hoy pierna')
            ->assertJsonPath('data.1.body', '¡A tope!');

        // Caducada la historia, el mensaje sigue diciendo que era una respuesta.
        $this->travel(25)->hours();
        $this->artisan('stories:prune');
        $this->actingAs($ana)->getJson("/api/v1/conversations/{$conversation}/messages")
            ->assertJsonPath('data.0.story_reply', true)->assertJsonPath('data.0.story', null);
    }

    public function test_direct_messages_between_friends_only(): void
    {
        $me = $this->makeUser('Yo');
        $ana = $this->makeUser('Ana');
        $stranger = $this->makeUser('Extraño');
        $this->befriend($me, $ana);

        $this->actingAs($me)->postJson('/api/v1/conversations', ['user_id' => $stranger->id])->assertForbidden();
        $id = $this->actingAs($me)->postJson('/api/v1/conversations', ['user_id' => $ana->id])->assertOk()->json('data.id');
        // Abrirla otra vez (desde ella) da la misma conversación.
        $this->assertSame($id, $this->actingAs($ana)->postJson('/api/v1/conversations', ['user_id' => $me->id])->json('data.id'));

        $first = $this->actingAs($me)->postJson("/api/v1/conversations/{$id}/messages", ['body' => '  ¿Entrenas hoy?  '])
            ->assertCreated()->assertJsonPath('data.body', '¿Entrenas hoy?')->assertJsonPath('data.mine', true)->json('data.id');
        $this->actingAs($me)->postJson("/api/v1/conversations/{$id}/messages", ['body' => '   '])->assertStatus(422);

        $this->actingAs($ana)->getJson("/api/v1/conversations/{$id}/messages")->assertJsonPath('data.0.mine', false);
        $this->actingAs($ana)->postJson("/api/v1/conversations/{$id}/messages", ['body' => 'Sí, a las 7'])->assertCreated();
        $this->actingAs($me)->getJson("/api/v1/conversations/{$id}/messages?after={$first}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.body', 'Sí, a las 7');

        $this->actingAs($me)->getJson('/api/v1/conversations/unread-count')->assertJsonPath('unread', 1);
        $this->actingAs($me)->postJson("/api/v1/conversations/{$id}/read")->assertOk();
        $this->actingAs($me)->getJson('/api/v1/conversations/unread-count')->assertJsonPath('unread', 0);

        $this->actingAs($stranger)->getJson("/api/v1/conversations/{$id}/messages")->assertNotFound();
        $this->actingAs($stranger)->postJson("/api/v1/conversations/{$id}/messages", ['body' => 'hola'])->assertNotFound();
    }

    public function test_blocking_or_unfriending_stops_messages_but_keeps_history(): void
    {
        $me = $this->makeUser('Yo');
        $ana = $this->makeUser('Ana');
        $this->befriend($me, $ana);
        $id = $this->actingAs($me)->postJson('/api/v1/conversations', ['user_id' => $ana->id])->json('data.id');
        $this->actingAs($me)->postJson("/api/v1/conversations/{$id}/messages", ['body' => 'Hola'])->assertCreated();

        $this->actingAs($ana)->postJson("/api/v1/people/{$me->id}/block")->assertOk();
        $this->actingAs($me)->postJson("/api/v1/conversations/{$id}/messages", ['body' => '¿?'])->assertForbidden();
        $this->actingAs($me)->getJson("/api/v1/conversations/{$id}")->assertJsonPath('data.can_message', false);
        $this->actingAs($me)->getJson("/api/v1/conversations/{$id}/messages")->assertJsonCount(1, 'data');
    }

    public function test_own_story_can_be_deleted_only_by_owner(): void
    {
        $ana = $this->makeUser('Ana');
        $friend = $this->makeUser('Amigo');
        $this->befriend($ana, $friend);
        $id = $this->postStory($ana)->json('data.id');

        $this->actingAs($friend)->deleteJson("/api/v1/stories/{$id}")->assertNotFound();
        $this->actingAs($ana)->deleteJson("/api/v1/stories/{$id}")->assertOk();
        $this->assertNull(Story::query()->find($id));
    }
}
