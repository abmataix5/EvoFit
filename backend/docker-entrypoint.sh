#!/bin/sh
set -e

mkdir -p \
  storage/framework/sessions \
  storage/framework/views \
  storage/framework/cache \
  storage/logs \
  storage/app/public \
  bootstrap/cache

chmod -R ug+rwx storage bootstrap/cache || true

if [ ! -f vendor/autoload.php ]; then
  if [ "${APP_ENV:-local}" = "production" ]; then
    composer install --no-interaction --prefer-dist --no-dev --optimize-autoloader
  else
    composer install --no-interaction --prefer-dist
  fi
fi

if [ -n "${DB_HOST:-}" ]; then
  php <<'PHP'
<?php

$path = '.env';
$content = is_file($path) ? file_get_contents($path) : '';

$vars = [
    'APP_NAME' => getenv('APP_NAME') ?: 'EvoFit',
    'APP_ENV' => getenv('APP_ENV') ?: 'local',
    'APP_DEBUG' => getenv('APP_DEBUG') ?: 'true',
    'APP_URL' => getenv('APP_URL') ?: 'http://localhost:8080',
    'DB_CONNECTION' => getenv('DB_CONNECTION') ?: 'mysql',
    'DB_HOST' => getenv('DB_HOST') ?: 'mariadb',
    'DB_PORT' => getenv('DB_PORT') ?: '3306',
    'DB_DATABASE' => getenv('DB_DATABASE') ?: 'evofit',
    'DB_USERNAME' => getenv('DB_USERNAME') ?: 'evofit',
    'DB_PASSWORD' => getenv('DB_PASSWORD') ?: 'secret',
    'SESSION_DRIVER' => getenv('SESSION_DRIVER') ?: 'file',
    'SESSION_DOMAIN' => getenv('SESSION_DOMAIN') !== false ? (string) getenv('SESSION_DOMAIN') : '',
    'SESSION_SECURE_COOKIE' => getenv('SESSION_SECURE_COOKIE') ?: 'false',
    'SANCTUM_STATEFUL_DOMAINS' => getenv('SANCTUM_STATEFUL_DOMAINS') ?: 'localhost,127.0.0.1',
    'FRONTEND_URL' => getenv('FRONTEND_URL') ?: 'http://localhost:5173',
    'CORS_ALLOWED_ORIGINS' => getenv('CORS_ALLOWED_ORIGINS') ?: 'http://localhost:5173',
];

foreach ($vars as $key => $value) {
    $line = $key.'='.$value;
    if (preg_match('/^'.preg_quote($key, '/').'=.*/m', $content)) {
        $content = preg_replace('/^'.preg_quote($key, '/').'=.*/m', $line, $content);
    } else {
        $content .= PHP_EOL.$line;
    }
}

file_put_contents($path, $content);
PHP
fi

if ! grep -q '^APP_KEY=' .env 2>/dev/null; then
  echo 'APP_KEY=' >> .env
fi

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  php artisan key:generate --force
fi

php artisan migrate --force

php artisan storage:link --force 2>/dev/null || true

php artisan config:clear
php artisan route:clear
php artisan view:clear

exec "$@"
