<?php

namespace App\Services\Stories;

use App\Models\Story;
use App\Models\User;
use App\Models\WorkoutSession;
use App\Services\Images\JpegEncoder;
use App\Services\TrainingHighlightsService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Publica historias y resuelve sus stickers fitness en el servidor (la racha y lo que
 * toca hoy salen de tus datos reales, no de lo que diga el móvil).
 */
class StoryPublisher
{
    public function __construct(
        private readonly JpegEncoder $encoder,
        private readonly TrainingHighlightsService $highlights,
    ) {}

    /**
     * Lo que valdrían los stickers ahora mismo (para la vista previa al crear la historia).
     *
     * @return array{today: string|null, gym: string|null, streak: int|null}
     */
    public function stickerValues(User $user): array
    {
        $streak = (int) ($this->highlights->profileStats($user)['streak_weeks'] ?? 0);

        return [
            'today' => $this->todayLabel($user),
            'gym' => $user->gym_name,
            'streak' => $streak > 0 ? $streak : null,
        ];
    }

    /**
     * @param  array{text?: string|null, background?: string|null, gym?: string|null, show_today?: bool, show_streak?: bool}  $input
     */
    public function publish(User $user, array $input, ?UploadedFile $photo): Story
    {
        $values = $this->stickerValues($user);
        $stickers = [
            'today' => ($input['show_today'] ?? false) ? $values['today'] : null,
            'gym' => blank($input['gym'] ?? null) ? null : trim((string) $input['gym']),
            'streak' => ($input['show_streak'] ?? false) ? $values['streak'] : null,
        ];

        $path = null;
        if ($photo !== null) {
            $path = 'stories/'.$user->id.'/'.Str::uuid()->toString().'.jpg';
            Storage::disk(Story::PHOTO_DISK)->put($path, $this->encoder->encode($photo, 1920));
        }

        $story = Story::query()->create([
            'user_id' => $user->id,
            'photo_path' => $path,
            'background' => $path ? null : ($input['background'] ?? 'energy'),
            'text' => blank($input['text'] ?? null) ? null : trim((string) $input['text']),
            'stickers' => $stickers,
            'expires_at' => now()->addHours(Story::LIFETIME_HOURS),
        ]);

        $this->pruneExpired();

        return $story;
    }

    /**
     * Borra historias caducadas (y sus fotos). Se llama al publicar y con `stories:prune`.
     *
     * @return int Historias borradas.
     */
    public function pruneExpired(int $limit = 200): int
    {
        $expired = Story::query()->where('expires_at', '<=', now())->limit($limit)->get();
        $expired->each->delete();

        return $expired->count();
    }

    /** Día de rutina de hoy: el que se entrenó o, si no, el planificado. */
    private function todayLabel(User $user): ?string
    {
        $today = WorkoutSession::localToday()->toDateString();
        $session = WorkoutSession::query()
            ->withoutGlobalScope('tenant')
            ->with(['day' => fn ($q) => $q->withoutGlobalScope('tenant')])
            ->where('user_id', $user->id)
            ->where(fn ($q) => $q->whereDate('scheduled_date', $today)->orWhereDate('trained_on', $today))
            ->whereHas('routine', fn ($q) => $q->withoutGlobalScope('tenant')->where('is_active', true))
            ->orderByRaw('started_at IS NULL')
            ->orderByDesc('started_at')
            ->first();

        return $session?->day?->name;
    }
}
