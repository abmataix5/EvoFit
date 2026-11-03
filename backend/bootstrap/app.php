<?php

use App\Http\Middleware\EnforceTenantContext;
use App\Http\Middleware\SetTenantFromUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->statefulApi();
        $middleware->append(EnforceTenantContext::class);
        $middleware->alias([
            'tenant' => SetTenantFromUser::class,
        ]);
        // El tenant debe fijarse antes de resolver los modelos de la ruta,
        // para que el scope global filtre también el route model binding.
        // (Queda después de auth, que va antes de SubstituteBindings en la lista.)
        $middleware->prependToPriorityList(SubstituteBindings::class, SetTenantFromUser::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
