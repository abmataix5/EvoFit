<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\StoreCatalogExerciseRequest;
use App\Http\Requests\Catalog\UpdateCatalogExerciseRequest;
use App\Http\Resources\CatalogExerciseResource;
use App\Models\CatalogExercise;
use App\Models\Exercise;
use App\Services\CatalogExerciseResolver;
use App\Services\ExerciseLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class CatalogExerciseController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = CatalogExercise::query()
            ->with('exercise')
            ->where('user_id', $request->user()->id)
            ->orderBy('name');

        if ($search = trim((string) $request->query('q', ''))) {
            // % y _ son comodines de LIKE: se escapan (con '!', portable MariaDB/SQLite).
            $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
            $query->where(function ($builder) use ($like) {
                $builder
                    ->whereRaw("name LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("target_muscle LIKE ? ESCAPE '!'", [$like]);
            });
        }

        return CatalogExerciseResource::collection($query->get());
    }

    public function store(
        StoreCatalogExerciseRequest $request,
        CatalogExerciseResolver $resolver,
        ExerciseLibrary $library,
    ): JsonResponse {
        $payload = $request->validated();

        if (! empty($payload['exercise_id'])) {
            // Añadir de la biblioteca: si ya lo tenía, se devuelve el suyo.
            $exercise = $resolver->fromLibrary($request->user(), Exercise::query()->findOrFail($payload['exercise_id']));

            return response()->json([
                'exercise' => new CatalogExerciseResource($exercise->load('exercise')),
            ], $exercise->wasRecentlyCreated ? 201 : 200);
        }

        // Un propio que se llama igual que uno de la biblioteca queda enlazado con él.
        $match = $library->match($payload['name']);
        $libraryTaken = $match && CatalogExercise::query()
            ->where('user_id', $request->user()->id)
            ->where('exercise_id', $match->id)
            ->exists();

        $exercise = CatalogExercise::query()->create([
            'user_id' => $request->user()->id,
            'exercise_id' => $libraryTaken ? null : $match?->id,
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
            'exercise' => new CatalogExerciseResource($exercise->load('exercise')),
        ], 201);
    }

    public function update(UpdateCatalogExerciseRequest $request, CatalogExercise $catalogExercise): CatalogExerciseResource
    {
        $payload = $request->validated();

        DB::transaction(function () use ($catalogExercise, $payload) {
            $catalogExercise->update($payload);

            // Mantener alineadas las rutinas que usan este catálogo.
            $sync = [];
            foreach (['name', 'target_muscle', 'tracking_mode', 'time_direction', 'default_duration_seconds'] as $field) {
                if (array_key_exists($field, $payload)) {
                    $sync[$field] = $catalogExercise->{$field};
                }
            }
            if ($sync !== []) {
                $catalogExercise->routineExercises()->update($sync);
            }
        });

        return new CatalogExerciseResource($catalogExercise->fresh()->load('exercise'));
    }

    public function destroy(CatalogExercise $catalogExercise): JsonResponse
    {
        $this->authorize('delete', $catalogExercise);
        $catalogExercise->delete();

        return response()->json(['message' => 'Ejercicio eliminado del catálogo.']);
    }
}
