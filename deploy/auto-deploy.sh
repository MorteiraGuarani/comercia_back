#!/usr/bin/env bash
# Auto-deploy en modo LAN: consulta GHCR y, si hay imagen nueva de api o web,
# actualiza el stack (incluye re-ejecución de migraciones vía servicio migrate).
# Lo instala el aprovisionamiento como cron del usuario deploy:
#   */3 * * * * bash /opt/comercia/deploy/auto-deploy.sh >> /home/deploy/comercia-autodeploy.log 2>&1
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"
IMAGES="ghcr.io/morteiraguarani/comercia-api:latest ghcr.io/morteiraguarani/comercia-web:latest"

# Lock: si ya hay un deploy corriendo, salir en silencio
exec 9>/tmp/comercia-autodeploy.lock
flock -n 9 || exit 0

cd "$APP_DIR"

digests() {
  docker image inspect --format '{{index .RepoDigests 0}}' $IMAGES 2>/dev/null | sort || true
}

before="$(digests)"
$COMPOSE pull --quiet api web
after="$(digests)"

if [ "$before" != "$after" ]; then
  echo "[$(date '+%F %T')] Imagen nueva en GHCR; backup previo al deploy..."
  bash "$APP_DIR/deploy/backup.sh"
  echo "[$(date '+%F %T')] Actualizando stack..."
  $COMPOSE up -d --remove-orphans
  $COMPOSE ps
  docker image prune -f >/dev/null
  echo "[$(date '+%F %T')] Deploy OK"
fi
