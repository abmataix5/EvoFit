<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware global: durante una petición HTTP los modelos con tenant exigen
 * contexto (lo pone SetTenantFromUser en las rutas autenticadas). Login y
 * registro no tocan modelos con tenant, así que no les afecta.
 */
class EnforceTenantContext
{
    public function handle(Request $request, Closure $next): Response
    {
        TenantContext::enforce(true);

        try {
            return $next($request);
        } finally {
            TenantContext::enforce(false);
            TenantContext::clear();
        }
    }
}
