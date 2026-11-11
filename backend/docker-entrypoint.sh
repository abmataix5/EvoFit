#!/bin/sh
set -e

APP_ENV="${APP_ENV:-local}"
export APP_ENV

fail() {
  echo "[entrypoint] ERROR: $*" >&2
  exit 1
}

if [ "$APP_ENV" = "production" ]; then
  # En producción no hay valores por defecto inseguros: sin contraseña de BD no arrancamos.
  [ -n "${DB_PASSWORD:-}" ] || fail "DB_PASSWORD no está definido (revisa .env)."
  # Por defecto, nada de trazas de error al público.
  export APP_DEBUG="${APP_DEBUG:-false}"
fi

mkdir -p \
  storage/framework/sessions \
  storage/framework/views \
  storage/framework/cache \
  storage/logs \
  storage/app/public \
  storage/app/private \
  bootstrap/cache

chmod -R ug+rwx storage bootstrap/cache || true

# vendor/ vive en un volumen: se reinstala si falta o si composer.lock ha cambiado desde la última vez.
lock_hash="$(sha1sum composer.lock 2>/dev/null | cut -d' ' -f1)"
if [ ! -f vendor/autoload.php ] || [ "$(cat vendor/.composer-lock-hash 2>/dev/null)" != "$lock_hash" ]; then
  if [ "$APP_ENV" = "production" ]; then
    composer install --no-interaction --prefer-dist --no-dev --optimize-autoloader
  else
    composer install --no-interaction --prefer-dist
  fi
  echo "$lock_hash" > vendor/.composer-lock-hash
fi

# Una caché de configuración vieja haría que artisan ignorase el .env que escribimos ahora.
rm -f bootstrap/cache/config.php

if [ -n "${DB_HOST:-}" ]; then
  php <<'PHP'
<?php

$path = '.env';
$content = is_file($path) ? file_get_contents($path) : '';
$production = (getenv('APP_ENV') ?: 'local') === 'production';

$vars = [
    'APP_NAME' => getenv('APP_NAME') ?: 'EvoFit',
    'APP_ENV' => getenv('APP_ENV') ?: 'local',
    'APP_DEBUG' => getenv('APP_DEBUG') ?: ($production ? 'false' : 'true'),
    'APP_URL' => getenv('APP_URL') ?: 'http://localhost:8080',
    'DB_CONNECTION' => getenv('DB_CONNECTION') ?: 'mysql',
    'DB_HOST' => getenv('DB_HOST') ?: 'mariadb',
    'DB_PORT' => getenv('DB_PORT') ?: '3306',
    'DB_DATABASE' => getenv('DB_DATABASE') ?: 'evofit',
    'DB_USERNAME' => getenv('DB_USERNAME') ?: 'evofit',
    // En producción el entrypoint ya ha fallado si falta; 'secret' es solo para local.
    'DB_PASSWORD' => getenv('DB_PASSWORD') ?: 'secret',
    'SESSION_DRIVER' => getenv('SESSION_DRIVER') ?: 'file',
    'SESSION_DOMAIN' => getenv('SESSION_DOMAIN') !== false ? (string) getenv('SESSION_DOMAIN') : '',
    'SESSION_SECURE_COOKIE' => getenv('SESSION_SECURE_COOKIE') ?: ($production ? 'true' : 'false'),
    'SANCTUM_STATEFUL_DOMAINS' => getenv('SANCTUM_STATEFUL_DOMAINS') ?: 'localhost,127.0.0.1',
    'FRONTEND_URL' => getenv('FRONTEND_URL') ?: 'http://localhost:5173',
    'CORS_ALLOWED_ORIGINS' => getenv('CORS_ALLOWED_ORIGINS') ?: 'http://localhost:5173',
    'MAIL_MAILER' => getenv('MAIL_MAILER') ?: 'log',
    'MAIL_SCHEME' => (string) getenv('MAIL_SCHEME'),
    'MAIL_HOST' => (string) getenv('MAIL_HOST'),
    'MAIL_PORT' => getenv('MAIL_PORT') ?: '587',
    'MAIL_USERNAME' => (string) getenv('MAIL_USERNAME'),
    // Entre comillas: las contraseñas de SMTP suelen llevar símbolos.
    'MAIL_PASSWORD' => '"'.addcslashes((string) getenv('MAIL_PASSWORD'), '"\\$').'"',
    'MAIL_FROM_ADDRESS' => getenv('MAIL_FROM_ADDRESS') ?: 'no-reply@evofit.app',
    'MAIL_FROM_NAME' => '"'.(getenv('MAIL_FROM_NAME') ?: 'EvoFit').'"',
];

// Asegurar línea APP_KEY (key:generate la necesita para poder reemplazarla)
if (! preg_match('/^APP_KEY=/m', $content)) {
    $content .= PHP_EOL.'APP_KEY=';
}

foreach ($vars as $key => $value) {
    $line = $key.'='.$value;
    if (preg_match('/^'.preg_quote($key, '/').'=.*/m', $content)) {
        $content = preg_replace_callback('/^'.preg_quote($key, '/').'=.*/m', fn () => $line, $content);
    } else {
        $content .= PHP_EOL.$line;
    }
}

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "[entrypoint] No se puede escribir .env\n");
    exit(1);
}
PHP
fi

if ! grep -q '^APP_KEY=' .env 2>/dev/null; then
  echo 'APP_KEY=' >> .env
fi

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null && [ -z "${APP_KEY:-}" ]; then
  php artisan key:generate --force || true
  if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
    if [ "$APP_ENV" = "production" ]; then
      fail "No se pudo generar APP_KEY (¿.env de solo lectura?). Sin clave las sesiones no son seguras."
    fi
    echo "[entrypoint] Aviso: no se pudo generar APP_KEY." >&2
  fi
fi

# Copia de la BD antes de migrar en producción (solo si hay migraciones pendientes).
predeploy_backup() {
  command -v mariadb-dump >/dev/null 2>&1 || { echo "[entrypoint] mariadb-dump no disponible: sin copia previa." >&2; return 0; }

  status="$(php artisan migrate:status --no-ansi 2>/dev/null || true)"
  echo "$status" | grep -q 'Pending' || return 0

  if [ -d /backups ] && [ -w /backups ]; then
    dir=/backups/predeploy
  else
    dir=storage/app/private/predeploy-backups
  fi
  mkdir -p "$dir"
  file="$dir/evofit-predeploy-$(date +%Y%m%d-%H%M%S).sql.gz"

  echo "[entrypoint] Migraciones pendientes: copia previa en $file"
  # sh no tiene pipefail: el código de salida del volcado se guarda aparte.
  rc_file="$file.rc"
  { MYSQL_PWD="$DB_PASSWORD" mariadb-dump -h "${DB_HOST:-mariadb}" -P "${DB_PORT:-3306}" -u "${DB_USERNAME:-evofit}" \
      --single-transaction --quick --routines --triggers "${DB_DATABASE:-evofit}"; echo $? > "$rc_file"; } | gzip > "$file.tmp"
  rc="$(cat "$rc_file" 2>/dev/null || echo 1)"
  rm -f -- "$rc_file"
  if [ "$rc" = "0" ] && [ -s "$file.tmp" ]; then
    mv "$file.tmp" "$file"
    # Conservar las 10 copias pre-despliegue más recientes.
    ls -1t "$dir"/evofit-predeploy-*.sql.gz 2>/dev/null | tail -n +11 | while read -r old; do rm -f -- "$old"; done
  else
    rm -f -- "$file.tmp"
    fail "La copia previa a la migración ha fallado; no se migra."
  fi
}

if [ "$APP_ENV" = "production" ]; then
  predeploy_backup
fi

php artisan migrate --force

# Biblioteca común de ejercicios: se actualiza en cada arranque (idempotente) y enlaza
# con ella los ejercicios que los usuarios ya tenían.
php artisan exercises:sync || echo "[entrypoint] Aviso: exercises:sync ha fallado." >&2

# Fotos de progreso: del disco público (antiguo) al privado. Idempotente.
php artisan photos:make-private || echo "[entrypoint] Aviso: photos:make-private ha fallado." >&2

php artisan storage:link --force 2>/dev/null || true

if [ "$APP_ENV" = "production" ]; then
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache || true
else
  php artisan config:clear
  php artisan route:clear
  php artisan view:clear
fi

exec "$@"
