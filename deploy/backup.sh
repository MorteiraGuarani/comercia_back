#!/usr/bin/env bash
# Copia por pareja: PostgreSQL + volumen de archivos de COMERCIA.
# El .sha256 se publica al final; una pareja incompleta no se considera válida.
set -euo pipefail
umask 077

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"

# El cron diario y la copia previa al despliegue no pueden pisarse entre sí.
exec 8>/tmp/comercia-backup.lock
flock -w 600 8

STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="comercia-$STAMP"
TEMP_DIR="$(mktemp -d "$BACKUP_DIR/.${NAME}.XXXXXX")"
cleanup() {
  case "$TEMP_DIR" in
    "$BACKUP_DIR"/.comercia-*) rm -rf -- "$TEMP_DIR" ;;
  esac
}
trap cleanup EXIT

cd "$APP_DIR"
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$TEMP_DIR/$NAME.sql.gz"

# El tar se lee desde el volumen montado en la API, no desde su capa efímera.
docker compose -f docker-compose.prod.yml exec -T api \
  tar -C /app/uploads -czf - . > "$TEMP_DIR/$NAME.uploads.tar.gz"

test -s "$TEMP_DIR/$NAME.sql.gz"
test -s "$TEMP_DIR/$NAME.uploads.tar.gz"
gzip -t "$TEMP_DIR/$NAME.sql.gz"
tar -tzf "$TEMP_DIR/$NAME.uploads.tar.gz" > /dev/null
(
  cd "$TEMP_DIR"
  sha256sum "$NAME.sql.gz" "$NAME.uploads.tar.gz" > "$NAME.sha256"
  sha256sum -c "$NAME.sha256" > /dev/null
)

# Los archivos individuales se publican con rename atómico. El manifiesto es
# el marcador de que ambos existen y fueron comprobados.
mv "$TEMP_DIR/$NAME.sql.gz" "$BACKUP_DIR/"
mv "$TEMP_DIR/$NAME.uploads.tar.gz" "$BACKUP_DIR/"
mv "$TEMP_DIR/$NAME.sha256" "$BACKUP_DIR/"
rmdir "$TEMP_DIR"
TEMP_DIR=""

# Retención de parejas completas en la carpeta externa a Docker.
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'comercia-*.sql.gz' -o -name 'comercia-*.uploads.tar.gz' -o -name 'comercia-*.sha256' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "Backup OK: $BACKUP_DIR/$NAME.{sql.gz,uploads.tar.gz,sha256}"
