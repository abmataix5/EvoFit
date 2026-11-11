<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Story;
use App\Models\StoryView;
use App\Models\User;
use App\Services\Feed\PostPresenter;
use App\Services\Messaging\Messenger;
use App\Services\Stories\StoryPublisher;
use App\Services\Stories\StoryVisibility;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StoryController extends Controller
{
    public function __construct(private readonly StoryVisibility $visibility) {}

    /**
     * Barra de historias: las mías primero, luego quien tiene historias sin ver y al
     * final las ya vistas (las más recientes antes).
     */
    public function index(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $stories = Story::query()
            ->active()
            ->with('user')
            ->whereIn('user_id', $this->visibility->barAuthorIds($viewer))
            ->orderBy('id')
            ->get();
        $seen = StoryView::query()->where('viewer_id', $viewer->id)->whereIn('story_id', $stories->pluck('id'))->pluck('story_id')->flip();

        $groups = $stories
            ->groupBy('user_id')
            ->map(function ($items) use ($viewer, $seen) {
                $user = $items->first()->user;
                $presented = $items->map(fn (Story $s) => $this->present($s, isset($seen[$s->id]) || $s->user_id === $viewer->id))->values();

                return [
                    'user' => PostPresenter::author($user),
                    'mine' => $user->id === $viewer->id,
                    'has_unseen' => $presented->contains(fn ($s) => ! $s['seen']),
                    'latest_at' => $items->max('created_at')?->toIso8601String(),
                    'stories' => $presented,
                ];
            })
            ->sort(fn ($a, $b) => [$b['mine'], $b['has_unseen'], $b['latest_at']] <=> [$a['mine'], $a['has_unseen'], $a['latest_at']])
            ->values();

        return response()->json(['data' => $groups]);
    }

    public function stickers(Request $request, StoryPublisher $publisher): JsonResponse
    {
        return response()->json(['data' => $publisher->stickerValues($request->user())]);
    }

    public function store(Request $request, StoryPublisher $publisher): JsonResponse
    {
        $validated = $request->validate([
            'photo' => ['nullable', 'required_without:background', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
            'background' => ['nullable', 'required_without:photo', Rule::in(Story::BACKGROUNDS)],
            'text' => ['nullable', 'string', 'max:160'],
            'gym' => ['nullable', 'string', 'max:80'],
            'show_today' => ['sometimes', 'boolean'],
            'show_streak' => ['sometimes', 'boolean'],
        ], [
            'photo.required_without' => 'Elige una foto o un fondo.',
            'photo.mimes' => 'La foto tiene que ser JPG, PNG o WebP.',
            'photo.max' => 'La foto pesa demasiado (máximo 12 MB).',
            'text.max' => 'El texto puede tener como mucho 160 caracteres.',
        ]);

        $story = $publisher->publish($request->user(), [
            ...$validated,
            'show_today' => $request->boolean('show_today'),
            'show_streak' => $request->boolean('show_streak'),
        ], $request->file('photo'));

        return response()->json(['data' => $this->present($story, true)], 201);
    }

    public function destroy(Request $request, Story $story): JsonResponse
    {
        abort_unless($story->user_id === $request->user()->id, 404);
        $story->delete();

        return response()->json(['message' => 'Historia eliminada.']);
    }

    public function view(Request $request, Story $story): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($this->visibility->canView($viewer, $story), 404);

        if ($story->user_id !== $viewer->id) {
            try {
                StoryView::query()->firstOrCreate(['story_id' => $story->id, 'viewer_id' => $viewer->id]);
            } catch (UniqueConstraintViolationException) {
                // Dos marcas a la vez desde el mismo móvil: ya estaba vista.
            }
        }

        return response()->json(['seen' => true]);
    }

    /** "Visto por": solo para quien publicó la historia. */
    public function viewers(Request $request, Story $story): JsonResponse
    {
        abort_unless($story->user_id === $request->user()->id, 404);

        $views = $story->views()->with('viewer')->latest('id')->get();

        return response()->json([
            'data' => $views->filter(fn (StoryView $v) => $v->viewer)->map(fn (StoryView $v) => [
                ...PostPresenter::author($v->viewer),
                'viewed_at' => $v->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    /** Responder o reaccionar a una historia: llega como mensaje privado a quien la publicó. */
    public function reply(Request $request, Story $story, Messenger $messenger): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($this->visibility->canView($viewer, $story), 404);
        abort_if($story->user_id === $viewer->id, 422, 'No puedes responder a tu propia historia.');
        $validated = $request->validate([
            'body' => ['nullable', 'required_without:reaction', 'string', 'max:1000'],
            'reaction' => ['nullable', 'required_without:body', Rule::in(['🔥', '💪', '👏', '😍', '😂', '😮', '❤️', '🏆'])],
        ]);

        $message = $messenger->send($viewer, User::query()->findOrFail($story->user_id), [
            'body' => $validated['body'] ?? null,
            'reaction' => $validated['reaction'] ?? null,
            'story' => $story,
        ]);

        return response()->json(['conversation_id' => $message->conversation_id], 201);
    }

    public function photo(Request $request, Story $story): StreamedResponse
    {
        abort_unless($this->visibility->canView($request->user(), $story), 404);
        $disk = Storage::disk(Story::PHOTO_DISK);
        abort_unless($story->photo_path && $disk->exists($story->photo_path), 404);

        return $disk->response($story->photo_path, null, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** @return array<string, mixed> */
    private function present(Story $story, bool $seen): array
    {
        return [
            'id' => $story->id,
            'photo_url' => $story->photoUrl(),
            'background' => $story->background,
            'text' => $story->text,
            'stickers' => $story->stickers,
            'created_at' => $story->created_at?->toIso8601String(),
            'expires_at' => $story->expires_at?->toIso8601String(),
            'seen' => $seen,
        ];
    }
}
