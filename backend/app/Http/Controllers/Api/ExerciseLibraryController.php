<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExerciseResource;
use App\Models\Exercise;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Biblioteca común: la misma para todos. Son pocos cientos de filas, así que se manda
 * entera y el filtrado (músculo, material, búsqueda) se hace en el móvil, sin esperas.
 */
class ExerciseLibraryController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ExerciseResource::collection(Exercise::query()->orderBy('name')->get());
    }
}
