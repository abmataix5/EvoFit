#!/usr/bin/env bash
# Copia de seguridad diaria de EvoFit (servicio `backup` de docker-compose.prod.yml).
#   - BD:    /backups/evofit-db-YYYYmmdd-HHMMSS.sql.gz
#   - Fotos: /backups/evofit-photos-YYYYmmdd-HHMMSS.tar.gz
# Borra las copias con más de BACKUP_KEEP_DAYS días.
# La contraseña llega en MYSQL_PWD (no aparece en la lista de procesos).
set -uo pipefail

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
DIR=/backups

mkdir -p "$DIR"

while true; do
  ts="$(date +%Y%m%d-%H%M%S)"

  db_tmp="$DIR/.evofit-db-$ts.sql.gz.tmp"
  if mariadb-dump -h "$DB_HOST" -u "$DB_USERNAME" --single-transaction --quick --routines --triggers "$DB_DATABASE" | gzip > "$db_tmp"; then
    mv "$db_tmp" "$DIR/evofit-db-$ts.sql.gz"
    echo "[backup] BD -> evofit-db-$ts.sql.gz"
  else
    rm -f -- "$db_tmp"
    echo "[backup] ERROR en mariadb-dump" >&2
  fi

  photos_tmp="$DIR/.evofit-photos-$ts.tar.gz.tmp"
  if tar -czf "$photos_tmp" -C /data private public; then
    mv "$photos_tmp" "$DIR/evofit-photos-$ts.tar.gz"
    echo "[backup] fotos -> evofit-photos-$ts.tar.gz"
  else
    rm -f -- "$photos_tmp"
    echo "[backup] ERROR empaquetando fotos" >&2
  fi

  find "$DIR" -maxdepth 1 -type f -name 'evofit-*.gz' -mtime +"$((KEEP_DAYS - 1))" -delete

  sleep "$INTERVAL"
done
