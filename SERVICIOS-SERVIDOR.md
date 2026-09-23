# Servicios en el servidor: dónde están y cómo verlos

Guía práctica para inspeccionar el back (`:1001`), el front (`:1002`), PostgreSQL
y Docker en el servidor Linux (`172.19.0.140`) — por comando y por interfaz visual.

Para saber dónde se guardan las fotos, los adjuntos, los logos y sus copias, ver
[Almacenamiento en producción](docs/almacenamiento-en-produccion.md).

## El mapa: dónde vive cada cosa en el Linux

```
/opt/comercia/                        ← la "casa" de la aplicación
├── docker-compose.prod.yml           ← define qué servicios corren y cómo
├── .env                              ← configuración y secretos de producción
├── deploy/                           ← scripts (auto-deploy, backup) y docs
└── backups/                          ← base + fotos verificadas (30 días)

Docker (el motor corre como servicio del sistema)
├── comercia-api-1        → backend NestJS   (puerto 1001 → 3001 interno)
├── comercia-web-1        → frontend Next.js (puerto 1002 → 3000 interno)
├── comercia-postgres-1   → PostgreSQL      (solo 127.0.0.1:5432, no expuesto a la red)
└── portainer             → interfaz web de Docker (solo 127.0.0.1:9443)

Datos de PostgreSQL (FUERA de los contenedores, sobreviven a todo):
└── volumen "comercia_postgres_data" → /var/lib/docker/volumes/comercia_postgres_data/_data
```

Las imágenes vienen de `ghcr.io/mschuf/comercia-api` y `comercia-web` (las construye
GitHub Actions en cada push; el servidor las baja solo cada 3 minutos).

## De dónde salen los puertos 1001/1002 (y cómo cambiarlos)

Cada servicio tiene DOS puertos: el **interno** del contenedor (fijo, no se toca)
y el **externo** del servidor (configurable). El mapeo vive en
[docker-compose.prod.yml](docker-compose.prod.yml):

```yaml
api:
  ports:
    - "${API_PORT:-1001}:3001"    # externo : interno
web:
  ports:
    - "${WEB_PORT:-1002}:3000"
```

`${API_PORT:-1001}` significa: "usar la variable `API_PORT` del `.env` del servidor
(`/opt/comercia/.env`), y si no está, usar 1001". Los internos (3001 API, 3000 web)
los fijan los Dockerfiles y no hace falta cambiarlos nunca: para mover un servicio
de puerto solo se cambia el lado externo.

Además del compose, un puerto externo depende de DOS firewalls: el del servidor
(UFW, lo controlamos nosotros) y el de la red de la empresa (lo controla IT — hoy
deja pasar 22, 1001 y 1002; un puerto nuevo puede estar bloqueado, como nos pasó
con el 5901 del VNC).

### Cambiar el puerto del BACK (ej. 1001 → 2001)

```bash
# 1. En el servidor: editar /opt/comercia/.env y poner API_PORT=2001
ssh comercia "sed -i 's/^API_PORT=.*/API_PORT=2001/' /opt/comercia/.env"

# 2. Permitir el puerto nuevo en el firewall del servidor (como root)
ssh comercia-root "ufw allow 2001/tcp && ufw delete allow 1001/tcp"

# 3. Recrear el contenedor con el mapeo nuevo
ssh comercia "cd /opt/comercia && docker compose -f docker-compose.prod.yml up -d"

# 4. Probar desde tu PC (si esto falla, el firewall de IT bloquea el puerto nuevo)
curl http://172.19.0.140:2001/api/v1/health
```

**Y además** (solo si cambia el puerto del back): el front tiene la URL de la API
**horneada en el build** — editar `apps/web/.env.production` en el repo
(`NEXT_PUBLIC_API_URL=http://172.19.0.140:2001/api/v1`) y hacer commit + push para
que el pipeline reconstruya el front con la URL nueva.

### Cambiar el puerto del FRONT (ej. 1002 → 2002)

```bash
# 1. En el servidor: WEB_PORT nuevo + actualizar las URLs que apuntan al front
ssh comercia "sed -i -e 's/^WEB_PORT=.*/WEB_PORT=2002/' -e 's|:1002|:2002|g' /opt/comercia/.env"

# 2. Firewall del servidor
ssh comercia-root "ufw allow 2002/tcp && ufw delete allow 1002/tcp"

# 3. Recrear (el cambio de FRONTEND_URL/CORS_ORIGINS lo toma la API al recrearse)
ssh comercia "cd /opt/comercia && docker compose -f docker-compose.prod.yml up -d"

# 4. Probar
curl -I http://172.19.0.140:2002
```

(Para el front NO hay que reconstruir imágenes: `FRONTEND_URL` y `CORS_ORIGINS`
son variables de runtime de la API, se leen al arrancar el contenedor.)

## Cómo entrar al servidor

| Vía | Cómo |
|---|---|
| Terminal (desde tu PC) | `ssh comercia` |
| Escritorio visual | TightVNC Viewer → `localhost::5901` (el túnel permanente ya corre solo) |

---

## Ver los servicios POR COMANDO

Todo esto en una terminal del servidor (`ssh comercia` o Konsole en el VNC):

```bash
# ¿Qué está corriendo y hace cuánto?
docker ps

# El stack completo con su estado de salud (healthy/unhealthy)
cd /opt/comercia
docker compose -f docker-compose.prod.yml ps

# ¿Los servicios responden? (desde cualquier máquina de la red)
curl http://172.19.0.140:1001/api/v1/health    # back: debe decir "ok" + database "up"
curl -I http://172.19.0.140:1002               # front: debe devolver HTTP 200

# ¿Qué puertos están escuchando en el servidor?
ss -ltn

# Logs en vivo (Ctrl+C para salir)
docker compose -f docker-compose.prod.yml logs -f api      # solo el back
docker compose -f docker-compose.prod.yml logs -f web      # solo el front
docker compose -f docker-compose.prod.yml logs -f          # todo junto

# Últimas 100 líneas sin quedarse mirando
docker compose -f docker-compose.prod.yml logs --tail 100 api

# CPU y memoria de cada contenedor
docker stats --no-stream

# Reiniciar un servicio puntual
docker compose -f docker-compose.prod.yml restart api

# Historial del deploy automático (cuándo se actualizó solo)
tail -20 /home/deploy/comercia-autodeploy.log
```

## Ver los servicios de forma VISUAL

**Portainer** (lo más completo — el "Docker Desktop" del servidor):
1. En el escritorio VNC, abrir Firefox → `https://localhost:9443`
2. Aceptar el aviso del certificado (es autofirmado, es normal)
3. *Containers* → ves los 4 contenedores con estado y consumo. Clic en uno →
   **Logs** (en vivo), **Stats** (gráficos de CPU/RAM), **Console** (terminal
   adentro del contenedor), **Inspect** (toda su configuración)

**lazydocker** (visual pero en la terminal — más rápido para un vistazo):
```bash
lazydocker      # flechas para navegar, x = menú de acciones, q = salir
```

---

## PostgreSQL

**Por comando** (psql, el cliente oficial):

```bash
cd /opt/comercia
docker compose -f docker-compose.prod.yml exec postgres psql -U comercia comercia
```

Adentro de psql:

```
\dt                              → listar las tablas
\d users                         → estructura de la tabla users
\l                               → listar las bases de datos
SELECT * FROM users LIMIT 10;    → ver datos (terminar siempre con ;)
SELECT count(*) FROM users;      → contar filas
SELECT * FROM _prisma_migrations; → qué migraciones se aplicaron y cuándo
\q                               → salir
```

**Visual**:
- **DBeaver en el servidor** (menú de Plasma): host `localhost`, puerto `5432`,
  base `comercia`, usuario `comercia`, contraseña → `grep POSTGRES_PASSWORD /opt/comercia/.env`
- **DBeaver en tu Windows**: igual pero puerto `15432` (va por el túnel permanente)

**Backups**: `ls -lh /opt/comercia/backups/` (base y volumen de fotos a las 03:00 y antes de cada despliegue). La tarea de Windows sigue copiando solo los `.sql.gz`. Ver [almacenamiento en producción](docs/almacenamiento-en-produccion.md).

---

## Chuleta de Docker (lo que vas a usar de verdad)

```bash
docker ps                        # contenedores corriendo
docker ps -a                     # incluye los detenidos (ej. migrate, que es one-shot)
docker images                    # imágenes descargadas y su tamaño
docker logs -f comercia-api-1    # logs de un contenedor por nombre
docker exec -it comercia-api-1 sh          # entrar a un contenedor (sale con exit)
docker stats                     # CPU/RAM en tiempo real (Ctrl+C sale)
docker inspect comercia-api-1    # toda la configuración de un contenedor
docker volume ls                 # los volúmenes (ahí están los datos de la base)
docker system df                 # cuánto disco usa Docker en total
docker image prune -f            # borrar imágenes viejas sin uso (seguro)
```

⚠️ **Nunca ejecutar**: `docker compose down -v` · `docker volume rm comercia_postgres_data`
· `docker system prune --volumes` — son los únicos comandos que borran los datos de la base.

## Si algo se ve mal, en orden:

1. `docker compose -f /opt/comercia/docker-compose.prod.yml ps` → ¿algo no está `healthy`?
2. `docker compose -f /opt/comercia/docker-compose.prod.yml logs --tail 50 <servicio>` → ¿qué dice el error?
3. `docker compose -f /opt/comercia/docker-compose.prod.yml restart <servicio>` → ¿se recupera?
4. `df -h /` y `free -h` → ¿disco lleno o sin memoria?
5. Si nada de eso: reiniciar el servidor entero es seguro — todo arranca solo
   (Docker, los contenedores, el VNC, los crons).
