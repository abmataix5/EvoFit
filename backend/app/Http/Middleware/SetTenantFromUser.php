<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetTenantFromUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Sin tenant no hay datos que servir: mejor 403 que una consulta sin filtrar.
        abort_if($user === null || $user->tenant_id === null, 403, 'Cuenta sin espacio de trabajo.');

        TenantContext::set((int) $user->tenant_id);

        try {
            return $next($request);
        } finally {
            TenantContext::clear();
        }
    }
}
