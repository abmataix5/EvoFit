<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Datos públicos de la página de precios: cuántas plazas gratis quedan.
 * Solo devuelve el número de plazas, nunca datos de las cuentas.
 */
class PricingController extends Controller
{
    /** Las primeras cuentas no pagan; a partir de ahí, cuota mensual. */
    public const FOUNDER_SPOTS = 100;

    public function show(): JsonResponse
    {
        $taken = min(self::FOUNDER_SPOTS, User::query()->count());

        return response()->json([
            'founder_spots' => self::FOUNDER_SPOTS,
            'founder_spots_left' => self::FOUNDER_SPOTS - $taken,
        ]);
    }
}
