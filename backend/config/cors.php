<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],
    'allowed_methods' => ['*'],
    // La web (por entorno) y las apps de iOS y Android, que cargan desde su propio origen local.
    'allowed_origins' => [
        ...array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'))),
        'capacitor://localhost',
        'https://localhost',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
