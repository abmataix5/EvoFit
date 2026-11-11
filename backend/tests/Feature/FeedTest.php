<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Post;
use App\Models\User;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class FeedTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    private function befriend(User $a, User $b): void
    {
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => 'accepted', 'accepted_at' => now()]);
    }

    /** Usuario con un entreno completado: press banca 3 series (récord en la última) y remo. */
    private function trainedUser(string $name = 'Ana'): array
    {
        $user = $this->makeUser($name);
        $user->update(['gym_name' => 'Basic Fit']);
        [, $day, $exercises] = $this->makeRoutine($user, ['Press banca' => [], 'Remo' => []]);

        $old = $this->makeSession($day, now()->subWeek()->toDateString(), now()->subWeek()->toDateTimeString());
        $this->logSet($old, $exercises['Press banca'], 1, 80, 5);

        $session = $this->makeSession($day, now()->toDateString(), now()->subMinutes(50)->toDateTimeString(), ['completed_at' => now()]);
        $this->logSet($session, $exercises['Press banca'], 1, 80, 5);
        $this->logSet($session, $exercises['Press banca'], 2, 85, 3);
        $this->logSet($session, $exercises['Remo'], 1, 60, 10);

        return [$user, $session];
    }

    private function share(User $user, WorkoutSession $session, array $data = []): TestResponse
    {
        return $this->actingAs($user)->post("/api/v1/workout-sessions/{$session->id}/share", $data, ['Accept' => 'application/json']);
    }

    public function test_sharing_builds_summary_on_the_server(): void
    {
        [$ana, $session] = $this->trainedUser();

        $this->share($ana, $session, ['caption' => '  Buen día de pecho  '])
            ->assertCreated()
            ->assertJsonPath('data.caption', 'Buen día de pecho')
            ->assertJsonPath('data.gym_name', 'Basic Fit')
            ->assertJsonPath('data.summary.title', 'Día A')
            ->assertJsonPath('data.summary.sets', 3)
            ->assertJsonPath('data.summary.volume_kg', 80 * 5 + 85 * 3 + 60 * 10)
            ->assertJsonPath('data.summary.duration_minutes', 50)
            ->assertJsonPath('data.summary.exercises.0.name', 'Press banca')
            ->assertJsonPath('data.summary.exercises.0.best', '85 kg × 3')
            ->assertJsonPath('data.summary.records', ['Press banca'])
            ->assertJsonPath('data.mine', true);

        // Volver a compartir edita la misma publicación.
        $this->share($ana, $session, ['caption' => 'Editado'])->assertOk()->assertJsonPath('data.caption', 'Editado');
        $this->assertSame(1, Post::query()->count());
    }

    public function test_cannot_share_others_or_empty_sessions(): void
    {
        [$ana, $session] = $this->trainedUser();
        $intruder = $this->makeUser('Intruso');
        $this->share($intruder, $session)->assertNotFound();

        [, $day] = $this->makeRoutine($ana, ['Sentadilla' => []]);
        $empty = $this->makeSession($day, now()->addDay()->toDateString(), now()->toDateTimeString());
        $this->share($ana, $empty)->assertStatus(422);
    }

    public function test_photo_is_reencoded_and_private_to_allowed_viewers(): void
    {
        Storage::fake('local');
        [$ana, $session] = $this->trainedUser();
        $friend = $this->makeUser('Amigo');
        $stranger = $this->makeUser('Extraño');
        $this->befriend($ana, $friend);

        $url = $this->share($ana, $session, ['photo' => UploadedFile::fake()->image('gym.jpg', 3000, 2000)])
            ->assertCreated()->json('data.photo_url');
        $post = Post::query()->firstOrFail();
        [$w, $h] = getimagesizefromstring(Storage::disk('local')->get($post->photo_path));
        $this->assertSame([1440, 960], [$w, $h]);

        $this->actingAs($friend)->get($url)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->actingAs($stranger)->get($url)->assertNotFound();

        $this->share($ana, $session, ['remove_photo' => true])->assertJsonPath('data.photo_url', null);
        Storage::disk('local')->assertMissing($post->photo_path);
    }

    public function test_feed_shows_me_and_friends_respecting_privacy(): void
    {
        [$ana, $anaSession] = $this->trainedUser('Ana');
        [$luis, $luisSession] = $this->trainedUser('Luis');
        [$priv, $privSession] = $this->trainedUser('Privado');
        [$other, $otherSession] = $this->trainedUser('Desconocido');
        $me = $this->makeUser('Yo');
        $this->befriend($me, $ana);
        $this->befriend($luis, $me);
        $this->befriend($me, $priv);
        $priv->update(['profile_visibility' => 'private']);
        $other->update(['profile_visibility' => 'public']);

        foreach ([[$ana, $anaSession], [$luis, $luisSession], [$priv, $privSession], [$other, $otherSession]] as [$u, $s]) {
            $this->share($u, $s)->assertCreated();
        }

        $authors = collect($this->actingAs($me)->getJson('/api/v1/feed')->assertOk()->json('data'))->pluck('author.name')->all();
        // Del más reciente al más antiguo, solo amigos que comparten (ni el privado ni el desconocido público).
        $this->assertSame(['Luis', 'Ana'], $authors);

        $this->actingAs($me)->getJson("/api/v1/posts/{$this->postOf($other)->id}")->assertOk();
        $this->actingAs($me)->getJson("/api/v1/posts/{$this->postOf($priv)->id}")->assertNotFound();
        $this->actingAs($me)->getJson("/api/v1/people/{$ana->id}/posts")->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($me)->getJson("/api/v1/people/{$priv->id}/posts")->assertForbidden();
    }

    public function test_feed_pagination(): void
    {
        // 12 publicaciones en un segundo chocarían con el límite por minuto de la ruta.
        $this->withoutMiddleware(ThrottleRequests::class);
        $ana = $this->makeUser('Ana');
        [, $day, $exercises] = $this->makeRoutine($ana);
        for ($i = 0; $i < 12; $i++) {
            $s = $this->makeSession($day, now()->subDays($i)->toDateString(), now()->subDays($i)->toDateTimeString());
            $this->logSet($s, $exercises['Press banca'], 1, 50, 5);
            $this->share($ana, $s)->assertCreated();
        }

        $first = $this->actingAs($ana)->getJson('/api/v1/feed')->assertJsonCount(10, 'data');
        $before = $first->json('next_before');
        $this->assertNotNull($before);
        $this->actingAs($ana)->getJson("/api/v1/feed?before={$before}")->assertJsonCount(2, 'data')->assertJsonPath('next_before', null);
    }

    public function test_likes_are_counted_once_and_notify_author(): void
    {
        [$ana, $session] = $this->trainedUser();
        $friend = $this->makeUser('Amigo');
        $this->befriend($ana, $friend);
        $post = $this->postOf($ana, $session);

        $this->actingAs($friend)->postJson("/api/v1/posts/{$post->id}/like")->assertJsonPath('likes_count', 1)->assertJsonPath('liked_by_me', true);
        $this->actingAs($friend)->postJson("/api/v1/posts/{$post->id}/like")->assertJsonPath('likes_count', 1);
        $this->actingAs($friend)->getJson('/api/v1/feed')->assertJsonPath('data.0.liked_by_me', true);

        $this->actingAs($ana)->getJson('/api/v1/notifications')
            ->assertJsonPath('data.0.kind', 'post_like')->assertJsonPath('data.0.post_id', $post->id);

        $this->actingAs($friend)->deleteJson("/api/v1/posts/{$post->id}/like")->assertJsonPath('likes_count', 0);
        $this->actingAs($friend)->deleteJson("/api/v1/posts/{$post->id}/like")->assertJsonPath('likes_count', 0);

        // Mi propio "me gusta" no me notifica.
        $this->actingAs($ana)->postJson("/api/v1/posts/{$post->id}/like")->assertJsonPath('likes_count', 1);
        $this->assertSame(1, $ana->notifications()->count());

        $stranger = $this->makeUser('Extraño');
        $this->actingAs($stranger)->postJson("/api/v1/posts/{$post->id}/like")->assertNotFound();
    }

    public function test_comments_flow_and_permissions(): void
    {
        [$ana, $session] = $this->trainedUser();
        $friend = $this->makeUser('Amigo');
        $other = $this->makeUser('Otro');
        $this->befriend($ana, $friend);
        $this->befriend($ana, $other);
        $post = $this->postOf($ana, $session);

        $commentId = $this->actingAs($friend)->postJson("/api/v1/posts/{$post->id}/comments", ['body' => '  ¡Bestia! 💪 '])
            ->assertCreated()->assertJsonPath('data.body', '¡Bestia! 💪')->json('data.id');
        $this->actingAs($friend)->postJson("/api/v1/posts/{$post->id}/comments", ['body' => '   '])->assertStatus(422);

        $this->actingAs($ana)->getJson('/api/v1/notifications')
            ->assertJsonPath('data.0.kind', 'post_comment')->assertJsonPath('data.0.excerpt', '¡Bestia! 💪');
        $this->actingAs($ana)->getJson('/api/v1/feed')
            ->assertJsonPath('data.0.comments_count', 1)->assertJsonPath('data.0.comments_preview.0.body', '¡Bestia! 💪');

        // Ni otro amigo puede borrarlo; sí quien lo escribió o la dueña del entreno.
        $this->actingAs($other)->deleteJson("/api/v1/comments/{$commentId}")->assertNotFound();
        $this->actingAs($ana)->getJson("/api/v1/posts/{$post->id}/comments")->assertJsonPath('data.0.can_delete', true);
        $this->actingAs($ana)->deleteJson("/api/v1/comments/{$commentId}")->assertOk()->assertJsonPath('comments_count', 0);
    }

    public function test_only_author_deletes_post_and_its_notifications_disappear(): void
    {
        [$ana, $session] = $this->trainedUser();
        $friend = $this->makeUser('Amigo');
        $this->befriend($ana, $friend);
        $post = $this->postOf($ana, $session);
        $this->actingAs($friend)->postJson("/api/v1/posts/{$post->id}/like");

        $this->actingAs($friend)->deleteJson("/api/v1/posts/{$post->id}")->assertNotFound();
        $this->actingAs($ana)->deleteJson("/api/v1/posts/{$post->id}")->assertOk();
        $this->assertSame(0, Post::query()->count());
        $this->actingAs($ana)->getJson('/api/v1/notifications')->assertJsonCount(0, 'data');
    }

    public function test_session_exposes_its_post_and_post_can_be_edited(): void
    {
        Storage::fake('local');
        [$ana, $session] = $this->trainedUser();
        $this->actingAs($ana)->getJson("/api/v1/workout-sessions/{$session->id}")->assertJsonPath('data.post', null);

        $postId = $this->share($ana, $session, ['caption' => 'Primero'])->json('data.id');
        $this->actingAs($ana)->getJson("/api/v1/workout-sessions/{$session->id}")
            ->assertJsonPath('data.post.id', $postId)->assertJsonPath('data.post.caption', 'Primero');

        $this->actingAs($ana)->post("/api/v1/posts/{$postId}", [
            'caption' => 'Editado',
            'gym_name' => 'Otro gym',
            'photo' => UploadedFile::fake()->image('p.jpg', 800, 1000),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.caption', 'Editado')
            ->assertJsonPath('data.gym_name', 'Otro gym')
            ->assertJsonPath('data.edited', true)
            ->assertJsonPath('data.summary.sets', 3);
        $this->assertNotNull(Post::query()->find($postId)->photo_path);

        // Un "me gusta" no marca la publicación como editada ni cambia la URL de la foto.
        $friend = $this->makeUser('Amigo');
        $this->befriend($ana, $friend);
        $url = Post::query()->find($postId)->photoUrl();
        $this->actingAs($friend)->postJson("/api/v1/posts/{$postId}/like");
        $this->assertSame($url, Post::query()->find($postId)->photoUrl());

        $this->actingAs($friend)->post("/api/v1/posts/{$postId}", ['caption' => 'hack'], ['Accept' => 'application/json'])->assertNotFound();
    }

    public function test_likers_list_and_preview_name(): void
    {
        [$ana, $session] = $this->trainedUser();
        $luis = $this->makeUser('Luis');
        $marta = $this->makeUser('Marta');
        $this->befriend($ana, $luis);
        $this->befriend($ana, $marta);
        $post = $this->postOf($ana, $session);

        $this->actingAs($luis)->postJson("/api/v1/posts/{$post->id}/like");
        $this->actingAs($marta)->postJson("/api/v1/posts/{$post->id}/like");

        $this->actingAs($ana)->getJson("/api/v1/posts/{$post->id}/likes")
            ->assertOk()->assertJsonPath('data.0.name', 'Marta')->assertJsonPath('data.1.name', 'Luis');
        $this->actingAs($ana)->getJson('/api/v1/feed')->assertJsonPath('data.0.liked_by.name', 'Marta');
        // A Marta se le muestra otra persona, no ella misma.
        $this->actingAs($marta)->getJson("/api/v1/posts/{$post->id}")->assertJsonPath('data.liked_by.name', 'Luis');
    }

    public function test_route_limits_do_not_count_other_requests(): void
    {
        [$ana, $session] = $this->trainedUser();
        // 25 peticiones normales no deben agotar el límite de 20/min para publicar.
        for ($i = 0; $i < 25; $i++) {
            $this->actingAs($ana)->getJson('/api/v1/feed')->assertOk();
        }
        $this->share($ana, $session)->assertCreated();
    }

    private function postOf(User $user, ?WorkoutSession $session = null): Post
    {
        return Post::query()->where('user_id', $user->id)
            ->when($session, fn ($q) => $q->where('workout_session_id', $session->id))
            ->firstOr(function () use ($user, $session) {
                $this->share($user, $session ?? WorkoutSession::query()->withoutGlobalScopes()->where('user_id', $user->id)->latest('id')->firstOrFail())->assertSuccessful();

                return Post::query()->where('user_id', $user->id)->latest('id')->firstOrFail();
            });
    }
}
