<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\Feed\PostPresenter;
use App\Services\Messaging\Messenger;
use App\Services\Stories\StoryVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ConversationController extends Controller
{
    private const PAGE = 30;

    public function __construct(private readonly Messenger $messenger) {}

    /** Bandeja: conversaciones con mensajes, la más reciente primero. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $conversations = Conversation::query()
            ->for($user)
            ->whereNotNull('last_message_at')
            ->with(['userOne', 'userTwo', 'latestMessage'])
            ->orderByDesc('last_message_at')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $conversations->map(fn (Conversation $c) => $this->summary($c, $user))->values(),
        ]);
    }

    /** Conversaciones con mensajes sin leer (para el contador del icono). */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = Conversation::query()->for($user)->whereNotNull('last_message_at')->get()
            ->filter(fn (Conversation $c) => $this->messenger->unreadIn($c, $user) > 0)
            ->count();

        return response()->json(['unread' => $count]);
    }

    /** Abrir (o crear) la conversación con un amigo. */
    public function open(Request $request): JsonResponse
    {
        $validated = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);
        $user = $request->user();
        $other = User::query()->findOrFail($validated['user_id']);
        abort_unless($this->messenger->canMessage($user, $other), 403, 'Solo puedes escribir a tus amigos.');

        $conversation = Conversation::between($user, $other)->load(['userOne', 'userTwo', 'latestMessage']);

        return response()->json(['data' => $this->summary($conversation, $user)]);
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();
        abort_unless($conversation->includes($user), 404);

        return response()->json(['data' => $this->summary($conversation->load(['userOne', 'userTwo', 'latestMessage']), $user)]);
    }

    /**
     * Mensajes en orden cronológico. `before` pagina hacia atrás; `after` trae solo los
     * nuevos (lo usa el chat abierto para refrescarse).
     */
    public function messages(Request $request, Conversation $conversation, StoryVisibility $stories): JsonResponse
    {
        $user = $request->user();
        abort_unless($conversation->includes($user), 404);
        $validated = $request->validate([
            'before' => ['nullable', 'integer', 'min:1'],
            'after' => ['nullable', 'integer', 'min:0'],
        ]);

        $query = $conversation->messages()->with('story.user');
        if (isset($validated['after'])) {
            $messages = $query->where('id', '>', $validated['after'])->orderBy('id')->limit(100)->get();
            $hasMore = false;
        } else {
            $messages = $query
                ->when($validated['before'] ?? null, fn ($q, $before) => $q->where('id', '<', $before))
                ->orderByDesc('id')
                ->limit(self::PAGE + 1)
                ->get();
            $hasMore = $messages->count() > self::PAGE;
            $messages = $messages->take(self::PAGE)->reverse()->values();
        }

        return response()->json([
            'data' => $messages->map(fn (Message $m) => $this->message($m, $user, $stories))->values(),
            'has_more' => $hasMore,
        ]);
    }

    public function send(Request $request, Conversation $conversation, StoryVisibility $stories): JsonResponse
    {
        $user = $request->user();
        abort_unless($conversation->includes($user), 404);
        $validated = $request->validate(['body' => ['required', 'string', 'max:1000']], [
            'body.required' => 'Escribe algo.',
            'body.max' => 'El mensaje puede tener como mucho 1000 caracteres.',
        ]);
        abort_if(trim($validated['body']) === '', 422, 'Escribe algo.');

        $message = $this->messenger->send($user, User::query()->findOrFail($conversation->otherUserId($user)), ['body' => $validated['body']]);

        return response()->json(['data' => $this->message($message, $user, $stories)], 201);
    }

    public function read(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->includes($request->user()), 404);
        $conversation->markReadBy($request->user());

        return response()->json(['read' => true]);
    }

    /** @return array<string, mixed> */
    private function summary(Conversation $conversation, User $user): array
    {
        $other = $conversation->user_one_id === $user->id ? $conversation->userTwo : $conversation->userOne;
        $last = $conversation->latestMessage;

        return [
            'id' => $conversation->id,
            'user' => PostPresenter::author($other),
            'can_message' => $other !== null && $this->messenger->canMessage($user, $other),
            'last_message' => $last ? [
                'mine' => $last->sender_id === $user->id,
                'preview' => $this->preview($last, $user),
                'created_at' => $last->created_at?->toIso8601String(),
            ] : null,
            'unread' => $this->messenger->unreadIn($conversation, $user),
        ];
    }

    private function preview(Message $message, User $user): string
    {
        $mine = $message->sender_id === $user->id;
        if ($message->story_reply && $message->reaction) {
            return $mine ? "Reaccionaste {$message->reaction} a su historia" : "Ha reaccionado {$message->reaction} a tu historia";
        }
        if ($message->story_reply) {
            return ($mine ? 'Respondiste a su historia: ' : 'Ha respondido a tu historia: ').Str::limit((string) $message->body, 60);
        }

        return Str::limit((string) $message->body, 80);
    }

    /** @return array<string, mixed> */
    private function message(Message $message, User $user, StoryVisibility $stories): array
    {
        $story = $message->story;

        return [
            'id' => $message->id,
            'mine' => $message->sender_id === $user->id,
            'body' => $message->body,
            'reaction' => $message->reaction,
            'story_reply' => $message->story_reply,
            // Miniatura de la historia mientras siga disponible para quien mira.
            'story' => $story && $stories->canView($user, $story) ? [
                'id' => $story->id,
                'photo_url' => $story->photoUrl(),
                'background' => $story->background,
                'text' => $story->text,
                'owner_id' => $story->user_id,
            ] : null,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }
}
