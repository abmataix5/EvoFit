<?php

namespace App\Services\Feed;

use App\Models\Post;
use App\Models\User;
use App\Models\WorkoutSession;
use App\Services\Images\JpegEncoder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Crea o edita una publicación: texto, gimnasio, foto y el resumen del entreno
 * (que se recalcula por si se han cambiado series después de publicar).
 */
class PostWriter
{
    public function __construct(
        private readonly WorkoutSummaryBuilder $summaries,
        private readonly JpegEncoder $encoder,
    ) {}

    /**
     * @param  array{caption?: string|null, gym_name?: string|null}  $fields
     */
    public function write(Post $post, User $author, array $fields, ?UploadedFile $photo = null, bool $removePhoto = false, ?WorkoutSession $session = null): Post
    {
        $isNew = ! $post->exists;
        $post->user_id = $author->id;

        if (array_key_exists('caption', $fields)) {
            $post->caption = blank($fields['caption']) ? null : trim((string) $fields['caption']);
        }
        if (array_key_exists('gym_name', $fields)) {
            $post->gym_name = blank($fields['gym_name']) ? null : trim((string) $fields['gym_name']);
        } elseif ($isNew) {
            $post->gym_name = $author->gym_name;
        }
        if ($session !== null) {
            $post->summary = $this->summaries->build($session);
        }

        $previousPhoto = $post->photo_path;
        if ($photo !== null) {
            $path = 'posts/'.$author->id.'/'.Str::uuid()->toString().'.jpg';
            Storage::disk(Post::PHOTO_DISK)->put($path, $this->encoder->encode($photo, 1440));
            $post->photo_path = $path;
        } elseif ($removePhoto) {
            $post->photo_path = null;
        }

        if (! $isNew && $post->isDirty(['caption', 'gym_name', 'photo_path'])) {
            $post->edited_at = now();
        }
        $post->save();

        if ($previousPhoto && $previousPhoto !== $post->photo_path) {
            Storage::disk(Post::PHOTO_DISK)->delete($previousPhoto);
        }

        return $post;
    }
}
