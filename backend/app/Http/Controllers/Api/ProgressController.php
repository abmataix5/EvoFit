<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Progress\StoreBodyWeightRequest;
use App\Http\Requests\Progress\StoreProgressPhotoRequest;
use App\Http\Resources\BodyWeightEntryResource;
use App\Http\Resources\ProgressPhotoResource;
use App\Models\BodyWeightEntry;
use App\Models\ProgressPhoto;
use App\Services\ProgressInsightService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgressController extends Controller
{
    public function bodyWeights(Request $request): AnonymousResourceCollection
    {
        $entries = BodyWeightEntry::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('recorded_on')
            ->limit(52)
            ->get();

        return BodyWeightEntryResource::collection($entries);
    }

    public function storeBodyWeight(StoreBodyWeightRequest $request): JsonResponse
    {
        $payload = $request->validated();

        $entry = BodyWeightEntry::query()->updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'recorded_on' => $payload['recorded_on'],
            ],
            [
                'weight_kg' => $payload['weight_kg'],
                'notes' => $payload['notes'] ?? null,
            ]
        );

        return response()->json([
            'entry' => new BodyWeightEntryResource($entry),
        ], 201);
    }

    public function photos(Request $request): AnonymousResourceCollection
    {
        $photos = ProgressPhoto::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('recorded_on')
            ->limit(52)
            ->get();

        return ProgressPhotoResource::collection($photos);
    }

    public function storePhoto(StoreProgressPhotoRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $file = $request->file('photo');

        $path = $file->store(
            'progress/'.$request->user()->tenant_id.'/'.$request->user()->id,
            'local'
        );

        $photo = ProgressPhoto::query()->create([
            'user_id' => $request->user()->id,
            'recorded_on' => $payload['recorded_on'],
            'disk' => 'local',
            'path' => $path,
            'caption' => $payload['caption'] ?? null,
        ]);

        return response()->json([
            'photo' => new ProgressPhotoResource($photo),
        ], 201);
    }

    public function destroyBodyWeight(BodyWeightEntry $bodyWeightEntry): JsonResponse
    {
        $this->authorize('delete', $bodyWeightEntry);
        $bodyWeightEntry->delete();

        return response()->json(['message' => 'Peso eliminado.']);
    }

    public function destroyPhoto(ProgressPhoto $progressPhoto): JsonResponse
    {
        $this->authorize('delete', $progressPhoto);
        // El modelo borra también el archivo (evento deleting).
        $progressPhoto->delete();

        return response()->json(['message' => 'Foto eliminada.']);
    }

    /**
     * Sirve la foto privada solo a su dueño.
     */
    public function photoImage(ProgressPhoto $progressPhoto): StreamedResponse
    {
        $this->authorize('view', $progressPhoto);

        $disk = Storage::disk($progressPhoto->disk ?: 'local');
        abort_unless($progressPhoto->path && $disk->exists($progressPhoto->path), 404);

        return $disk->response($progressPhoto->path, null, [
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function insights(Request $request, ProgressInsightService $insights): JsonResponse
    {
        return response()->json($insights->weeklyComparison($request->user()));
    }
}
