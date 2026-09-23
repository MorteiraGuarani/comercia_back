# Dónde guarda COMERCIA las fotos y los datos en producción

Verificado en el servidor `172.19.0.140` el 23/09/2026. Esta guía describe **COMERCIA**; UCHECK tiene contenedores y volúmenes propios.

## Mapa rápido

| Contenido | Dentro del contenedor | En el servidor |
| --- | --- | --- |
| Fotos, adjuntos y logos de COMERCIA | `/app/uploads` en `comercia-api-1` | Volumen Docker `comercia_uploads_data`: `/var/lib/docker/volumes/comercia_uploads_data/_data` |
| Datos de PostgreSQL | `/var/lib/postgresql/data` en `comercia-postgres-1` | Volumen Docker `comercia_postgres_data`: `/var/lib/docker/volumes/comercia_postgres_data/_data` |
| Configuración del despliegue | No aplica | `/opt/comercia/docker-compose.prod.yml` y `/opt/comercia/.env` |
| Copias verificadas de base y archivos | No aplica | `/opt/comercia/backups/comercia-AAAAmmdd-HHMMSS.{sql.gz,uploads.tar.gz,sha256}` |

La API recibe `UPLOADS_DIR=/app/uploads` y monta `comercia_uploads_data` en esa ruta. El código está en [`docker-compose.prod.yml`](../docker-compose.prod.yml) y [`multer-config.ts`](../apps/api/src/campo/utils/multer-config.ts). **La ruta del contenedor y la del servidor muestran los mismos archivos**; son las dos caras del mismo volumen. El nombre y punto de montaje se pueden confirmar con `docker volume inspect` porque pueden variar en otra instalación.

Los contenedores y las imágenes Docker son reemplazables. Los archivos que se escriban fuera de `/app/uploads` dentro del contenedor pueden desaparecer cuando se recrea la API. `docker compose up -d` conserva los volúmenes; comandos que eliminan volúmenes, como `docker compose down -v`, los borran.

## Qué archivo va en cada carpeta

Todas las rutas siguientes están **dentro de `/app/uploads`**:

| Uso | Ruta | Referencia guardada en PostgreSQL |
| --- | --- | --- |
| Fotos «antes» y «después» de tareas | `tareas/AAAA/MM/DD/<uuid>.jpg` (también puede ser PNG o WebP) | `campo_tarea_fotos`: momento, ruta, tipo, tamaño, usuario y visita/tarea. |
| Fotos de novedades y avisos | `adjuntos/AAAA/MM/DD/<uuid>.<extensión>` | `campo_adjuntos`: ruta, nombre original, tipo, tamaño y novedad o aviso. |
| Logos de clientes | `clientes/logo_<uuid>.<extensión>` | `campo_clientes.logo_url`: URL de la API que sirve el logo. |

**PostgreSQL guarda referencias y metadatos; no guarda los bytes de las imágenes.** Por eso hacen falta tanto la base como el volumen de uploads para una restauración completa. Algunas fotos de tareas antiguas tienen una ruta relativa `uploads/tareas/...`; las nuevas pueden tener `/app/uploads/tareas/...`. La API resuelve ambos formatos, siempre que el archivo exista en el volumen.

El navegador reduce las fotos grandes a un máximo de 1920 píxeles en su lado mayor y las envía como JPEG de hasta 5 MB. La API acepta JPG, PNG o WebP de hasta 5 MB para fotos y adjuntos; los logos también pueden ser SVG. Las novedades y los avisos admiten hasta cinco adjuntos. Véanse [`preparar-imagen.ts`](../apps/web/src/utils/preparar-imagen.ts) y [`multer-config.ts`](../apps/api/src/campo/utils/multer-config.ts).

La aplicación entrega las imágenes mediante la API, no mediante una carpeta pública: `/api/v1/campo/fotos/:id`, `/api/v1/campo/adjuntos/:id` y `/api/v1/campo/clientes/logos/:filename`. El módulo `campo` exige sesión; fotos de tareas y adjuntos verifican además el acceso al recurso.

## Cómo comprobarlo en el servidor

Ejecutar estos comandos **en una terminal del servidor**. Solo consultan el estado; no cambian archivos:

```bash
docker volume inspect comercia_uploads_data --format '{{.Mountpoint}}'
docker inspect comercia-api-1 --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{println}}{{end}}'
docker exec comercia-api-1 printenv UPLOADS_DIR
docker exec comercia-api-1 find /app/uploads -type f
docker exec comercia-api-1 du -sh /app/uploads
```

Para ver los registros de las fotos de tareas sin entrar al volumen de PostgreSQL:

```bash
docker exec comercia-postgres-1 psql -U comercia -d comercia -c \
  'SELECT id, momento, ruta_archivo, creado_at FROM campo_tarea_fotos ORDER BY id DESC LIMIT 20;'
```

Un registro en esa tabla confirma que la subida quedó anotada, **pero no demuestra que el archivo siga presente**. Para una foto concreta, comparar `ruta_archivo` con `find /app/uploads -type f` o usar `test -f` sobre la ruta completa dentro de `comercia-api-1`.

## Copias de seguridad y recuperación

[`deploy/backup.sh`](../deploy/backup.sh) crea **tres archivos con el mismo sello de tiempo** en `/opt/comercia/backups`, una carpeta normal del servidor, fuera de Docker:

1. `comercia-AAAAmmdd-HHMMSS.sql.gz`: base de datos completa mediante `pg_dump`.
2. `comercia-AAAAmmdd-HHMMSS.uploads.tar.gz`: todo `/app/uploads`, incluidas fotos, adjuntos y logos.
3. `comercia-AAAAmmdd-HHMMSS.sha256`: hashes de los dos archivos anteriores. Se publica al final, solo después de verificar ambos.

El cron ejecuta esta copia a las **03:00** y [`deploy/auto-deploy.sh`](../deploy/auto-deploy.sh) la ejecuta antes de reemplazar contenedores. Si esa copia falla, el despliegue automático se detiene y conserva la versión anterior. Los archivos del servidor se retienen **30 días**. Para hacer una copia manual: `bash /opt/comercia/deploy/backup.sh`.

La tarea programada de Windows **«Comercia - Copia de backups BD»** se ejecuta a las **09:30**, pero sigue descargando **solo los `.sql.gz`**. No transporta el archivo de imágenes. La copia completa solicitada en esta etapa queda en el mismo servidor, bajo `/opt/comercia/backups`, fuera de Docker.

Para comprobar una pareja en el servidor sin restaurarla:

```bash
cd /opt/comercia/backups
sha256sum -c comercia-AAAAmmdd-HHMMSS.sha256
gzip -t comercia-AAAAmmdd-HHMMSS.sql.gz
tar -tzf comercia-AAAAmmdd-HHMMSS.uploads.tar.gz > /dev/null
```

Una copia en **otra carpeta del mismo disco** protege frente a borrar el volumen o recrear un contenedor, pero no frente a avería o pérdida del servidor entero. Entre una subida y la siguiente ejecución de backups todavía puede haber pérdida. No existe garantía de «nunca perder» datos sin una réplica continua y otro destino independiente. Para una foto que ya falta en todas las copias, se necesita el original: la ruta en PostgreSQL no permite reconstruir los bytes. Una restauración completa debe usar la base y el archivo de uploads de la misma pareja, primero en un entorno de prueba.

### Caso comprobado el 23/09/2026

Dos fotos de una tarea quedaron registradas en `campo_tarea_fotos`, pero sus archivos no estaban en el volumen actual, en los directorios Docker ni en las copias SQL anteriores a este sistema. Se habían guardado antes de corregir la ruta de uploads y no se pueden reconstruir desde la base. Para restaurarlas hacen falta las fotos originales «antes» y «después». Las copias nuevas protegen los archivos que **sí existen** desde su primera ejecución; no recrean los ya perdidos.

## Despliegues y almacenamiento

GitHub Actions construye las imágenes de API y web y las publica en GHCR. El servidor consulta el registro cada tres minutos y recrea los contenedores si cambió la imagen. Esta operación conserva `comercia_uploads_data` y `comercia_postgres_data`; una imagen nueva **no contiene** las fotos subidas por los usuarios. El historial del cron se ve en `/home/deploy/comercia-autodeploy.log`.

La configuración sensible permanece en `/opt/comercia/.env`; no se incluye en este documento ni debe copiarse al repositorio.
