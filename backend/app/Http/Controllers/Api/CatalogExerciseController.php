<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\StoreCatalogExerciseRequest;
use App\Http\Requests\Catalog\UpdateCatalogExerciseRequest;
use App\Http\Resources\CatalogExerciseResource;
use App\Models\CatalogExercise;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CatalogExerciseController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = CatalogExercise::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('name');

        if ($search = trim((string) $request->query('q', ''))) {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', '%'.$search.'%')
                    ->orWhere('target_muscle', 'like', '%'.$search.'%');
            });
        }

        return CatalogExerciseResource::collection($query->get());
    }

    public function store(StoreCatalogExerciseRequest $request): JsonResponse
    {
        $payload = $request->validated();

        $exercise = CatalogExercise::query()->create([
            'user_id' => $request->user()->id,
            'name' => $payload['name'],
            'target_muscle' => $payload['target_muscle'] ?? null,
            'tracking_mode' => $payload['tracking_mode'] ?? 'weight_reps',
            'time_direction' => $payload['time_direction'] ?? 'faster',
            'default_sets' => $payload['default_sets'] ?? 3,
            'default_reps' => $payload['default_reps'] ?? 10,
            'default_duration_seconds' => $payload['default_duration_seconds'] ?? null,
            'rest_seconds' => $payload['rest_seconds'] ?? 90,
            'notes' => $payload['notes'] ?? null,
        ]);

        return response()->json([
            'exercise' => new CatalogExerciseResource($exercise),
        ], 201);
    }

    public function update(UpdateCatalogExerciseRequest $request, CatalogExercise $catalogExercise): CatalogExerciseResource
    {
        $this->authorizeExercise($catalogExercise);

        $payload = $request->validated();
        $catalogExercise->update($payload);

        // Mantener el nombre alineado en rutinas que usan este catálogo.
        if (array_key_exists('name', $payload)) {
            $catalogExercise->routineExercises()->update([
                'name' => $catalogExercise->name,
            ]);
        }

        $sync = [];
        foreach (['target_muscle', 'tracking_mode', 'time_direction', 'default_duration_seconds'] as $field) {
            if (array_key_exists($field, $payload)) {
                $sync[$field] = $catalogExercise->{$field};
            }
        }
        if ($sync !== []) {
            $catalogExercise->routineExercises()->update($sync);
        }

        return new CatalogExerciseResource($catalogExercise->fresh());
    }

    public function destroy(CatalogExercise $catalogExercise): JsonResponse
    {
        $this->authorizeExercise($catalogExercise);
        $catalogExercise->delete();

        return response()->json(['message' => 'Ejercicio eliminado del catálogo.']);
    }

    private function authorizeExercise(CatalogExercise $exercise): void
    {
        abort_unless($exercise->user_id === auth()->id(), 403, 'No autorizado.');
    }
}
