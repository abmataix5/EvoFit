<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Social\WeeklyLeague;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeagueController extends Controller
{
    /** Clasificación de la semana entre tú y tus amigos (weeks_ago=1 para la semana pasada). */
    public function show(Request $request, WeeklyLeague $league): JsonResponse
    {
        $validated = $request->validate([
            'weeks_ago' => ['nullable', 'integer', 'min:0', 'max:'.WeeklyLeague::MAX_WEEKS_AGO],
        ]);

        return response()->json($league->standings($request->user(), (int) ($validated['weeks_ago'] ?? 0)));
    }
}
