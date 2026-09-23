# Despliegue de Comercia en un servidor Linux

> **Modo actual: servidor en red local (LAN), sin dominio.** El servidor de
> producción es `172.19.0.140` (red privada): back en `:1001`, front en `:1002`.
> Como GitHub Actions no puede hacer SSH a una IP privada, el job `deploy` queda
> en no-op y el servidor se actualiza solo con [deploy/auto-deploy.sh](deploy/auto-deploy.sh)
> (cron cada 3 min que hace pull de GHCR). Caddy/HTTPS quedan bajo el perfil
> `domain` de compose para cuando haya dominio público. La instalación del
> servidor está documentada paso a paso en [deploy/BITACORA-SERVIDOR.md](deploy/BITACORA-SERVIDOR.md),
> y las automatizaciones del servidor (cron de deploy, fail2ban, unattended-upgrades)
> están explicadas en [deploy/AUTOMATIZACION-SERVIDOR.md](deploy/AUTOMATIZACION-SERVIDOR.md).
> Lo que sigue describe el diseño general (y el flujo por SSH para un VPS público).

Cómo funciona el pipeline completo: cada `git push` a `main` construye lo que cambió,
publica las imágenes Docker en GitHub Container Registry (GHCR) y actualiza el servidor
automáticamente. Es el mismo modelo que Vercel, pero corriendo en tu propio VPS.

```
git push a main
      │
      ▼
GitHub Actions (deploy.yml)
      ├─ test: lint + tests  ── si falla, NO se construye ni despliega nada
      ├─ changes: detecta si cambió apps/api, apps/web o la infraestructura
      ├─ build-api: imagen ghcr.io/mschuf/comercia-api  (solo si cambió la API)
      ├─ build-web: imagen ghcr.io/mschuf/comercia-web  (solo si cambió el front)
      └─ deploy: por SSH → docker compose pull && up -d en el servidor
      │
      ▼
Servidor Linux (/opt/comercia)
      Caddy (80/443, HTTPS automático)
        ├─ /api/*  → api (NestJS :3001)  → PostgreSQL (red interna)
        └─ resto   → web (Next.js :3000)
      migrate: prisma migrate deploy corre ANTES de levantar la API nueva
```

(`ci.yml` corre además en cada pull request, para validar cambios antes de mergearlos a `main`.)

## Arquitectura de robustez

| Capa | Mecanismo |
|------|-----------|
| Reinicio automático | `restart: unless-stopped` en todos los servicios: si un proceso muere o el servidor se reinicia, Docker lo vuelve a levantar solo. |
| Healthchecks | La API expone `/api/v1/health` (chequea también PostgreSQL) y el front responde en `/`. Docker marca el contenedor `unhealthy` y el orden de arranque respeta dependencias. |
| Migraciones seguras | El servicio `migrate` ejecuta `prisma migrate deploy` y la API solo arranca si terminó bien (`service_completed_successfully`). |
| Base de datos aislada | PostgreSQL vive en una red interna de Docker sin puertos publicados al exterior; solo la API llega a ella. |
| HTTPS automático | Caddy emite y renueva certificados Let's Encrypt solo con configurar `DOMAIN`. |
| Un solo origen | Caddy enruta `/api/*` a NestJS y el resto a Next.js: front y API comparten dominio, sin dolores de CORS. |
| Logs acotados | Rotación `json-file` 10 MB × 3 archivos por servicio: los logs nunca llenan el disco. |
| Backups | `deploy/backup.sh` + cron diario guarda PostgreSQL y uploads con SHA-256; retiene 30 días y bloquea el despliegue si falla la copia previa. |
| Rollback | Cada imagen queda etiquetada con el SHA del commit: volver atrás es cambiar `API_TAG`/`WEB_TAG` en el `.env` del servidor. |
| Deploys serializados | `concurrency` en Actions: nunca corren dos deploys a la vez. |
| Usuario no-root | Los contenedores de api y web corren con usuarios sin privilegios. |

---

## 1. Preparar el servidor (una sola vez)

Ubuntu 22.04/24.04 recomendado. Como root:

```bash
# Docker (motor + compose plugin)
curl -fsSL https://get.docker.com | sh

# Usuario de deploy con acceso al socket de Docker.
# OJO: pertenecer al grupo docker equivale a root en este servidor; quien tenga
# la clave SSH de este usuario controla la máquina. Cuidá esa clave.
adduser deploy
usermod -aG docker deploy

# Firewall: solo SSH, HTTP y HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Carpeta de la app
mkdir -p /opt/comercia
chown deploy:deploy /opt/comercia
```

Clave SSH para GitHub Actions (en tu máquina o en el servidor):

```bash
ssh-keygen -t ed25519 -f deploy_key -C "github-actions-comercia" -N ""
# La PÚBLICA va al servidor (creando ~/.ssh del usuario deploy con permisos correctos):
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cat deploy_key.pub >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
# La PRIVADA va al secret DEPLOY_SSH_KEY de GitHub (y después borrala del disco)
```

Login del servidor en GHCR (para poder bajar imágenes privadas). Crear un
[Personal Access Token (classic)](https://github.com/settings/tokens) con permiso
`read:packages` y, como usuario `deploy`:

```bash
docker login ghcr.io -u mschuf
# password: el PAT con read:packages (queda guardado en ~/.docker/config.json)
```

DNS: apuntar un registro `A` de `tudominio.com` a la IP del servidor.
Sin dominio todavía: usar `DOMAIN=:80` en el `.env` y entrar por `http://IP`.

## 2. Configurar el `.env` de producción

```bash
# como usuario deploy, en el servidor
cd /opt/comercia
# copiar deploy/.env.production.example como .env y completar:
nano .env
```

Generar secretos fuertes: `openssl rand -hex 32` (uno para `POSTGRES_PASSWORD`, otro para `COOKIE_SECRET`).

## 3. Configurar GitHub (una sola vez)

En el repo → Settings → Secrets and variables → Actions. Recomendado: crear los
secrets dentro del **environment `production`** (Settings → Environments → New
environment) en vez de a nivel repo — el job de deploy ya apunta a ese environment,
y así podés agregarle protection rules (aprobación manual, solo rama `main`) más adelante.

**Secrets**

| Nombre | Valor |
|--------|-------|
| `DEPLOY_HOST` | IP o dominio del servidor |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | contenido completo de la clave privada `deploy_key` |
| `DEPLOY_PORT` | (opcional) puerto SSH si no es 22 |

No hace falta configurar variables de Actions: la URL pública de la API que usa el
front vive commiteada en `apps/web/.env.production` y Next.js la carga sola durante
el build de la imagen.

> `NEXT_PUBLIC_API_URL` se hornea en el bundle del navegador durante el build del
> front; si cambia el dominio, editá `apps/web/.env.production` y hacé push (el
> pipeline reconstruye la imagen con la URL nueva).

## 4. Primer despliegue

Con todo lo anterior listo, alcanza con:

```bash
git push origin main
```

o lanzarlo a mano desde GitHub → Actions → Deploy → **Run workflow** (construye ambas imágenes).

Verificar en el servidor:

```bash
cd /opt/comercia
docker compose -f docker-compose.prod.yml ps        # postgres, api, web y caddy: "Up ... (healthy)"
docker compose -f docker-compose.prod.yml ps -a     # migrate es one-shot: debe figurar "Exited (0)"
docker compose -f docker-compose.prod.yml logs -f api
curl -s https://tudominio.com/api/v1/health
```

## 5. Operación diaria

| Acción | Comando |
|--------|---------|
| Ver estado | `docker compose -f docker-compose.prod.yml ps` |
| Logs en vivo | `docker compose -f docker-compose.prod.yml logs -f api web caddy` |
| Reiniciar un servicio | `docker compose -f docker-compose.prod.yml restart api` |
| Backup manual | `bash deploy/backup.sh` |
| Restaurar backup | `gunzip -c backups/comercia-XXXX.sql.gz \| docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |

Backup automático diario (como usuario `deploy`). Se invoca con `bash` porque el
`scp` de cada deploy re-copia el script y no conserva el bit de ejecución:

```bash
crontab -e
# agregar:
0 3 * * * bash /opt/comercia/deploy/backup.sh >> /home/deploy/comercia-backup.log 2>&1
```

El dump se genera con `--clean --if-exists`, así que restaurarlo sobre una base ya
migrada (por ejemplo recién levantada por el servicio `migrate`) funciona sin pasos previos.

## 6. Rollback (volver a una versión anterior)

Cada deploy publica las imágenes con dos tags: `latest` y el SHA del commit.
Para volver atrás:

```bash
cd /opt/comercia
# editar .env: API_TAG=<sha-del-commit-bueno> y/o WEB_TAG=<sha>
docker compose -f docker-compose.prod.yml up -d
# para volver a lo último: API_TAG=latest, WEB_TAG=latest y repetir
```

El SHA de cada deploy está en el historial de Actions o con `git log --oneline`.

> Ojo: si la versión nueva ya corrió una migración de base de datos, volver el código
> atrás no revierte la migración. Para cambios de esquema destructivos, hacer backup antes.

## 7. Checklist de seguridad antes de abrir al público

- [ ] `.env` del servidor con `POSTGRES_PASSWORD` y `COOKIE_SECRET` aleatorios (nunca los de ejemplo).
- [ ] `SWAGGER_ENABLED=false` en producción.
- [ ] `ufw` activo (solo 22, 80, 443) y SSH solo con clave (deshabilitar password: `PasswordAuthentication no` en `/etc/ssh/sshd_config`).
- [ ] `fail2ban` instalado (`apt install fail2ban`) para frenar fuerza bruta en SSH.
- [ ] Cron de backups activo y probado (restaurar una vez en local para validar).
- [ ] Actualizaciones automáticas de seguridad: `apt install unattended-upgrades`.
- [ ] Tener presente que `DEPLOY_SSH_KEY` da acceso root-equivalente al servidor (grupo docker): limitar quién puede escribir en el repo y ver los secrets.

## Mejoras futuras (cuando el tráfico lo justifique)

- **Monitoreo con alertas**: Uptime Kuma (self-hosted, un contenedor más) o UptimeRobot apuntando a `/api/v1/health`, con aviso por Telegram/email si se cae.
- **Zero-downtime real**: hoy hay ~5-15 s de corte al reemplazar el contenedor de la API. Si duele, migrar a `docker compose up -d --scale` con Caddy balanceando dos réplicas, o a un runtime tipo Kamal/Dokku/K3s.
- **Staging**: duplicar el stack en el mismo servidor bajo `staging.tudominio.com` desplegando la rama `develop`.
- **Réplicas de PostgreSQL** o backups off-site (subir los `.sql.gz` a S3/Backblaze con `rclone`).
