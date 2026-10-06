# Registro de entrega y producción

Fecha de trabajo: 2026-10-05.

## Código y verificaciones

La implementación de Comercia se publicó en el commit `6abe7feb4fdfff2cc2ac62eea106a1ac3f2266fc`. Pasaron 184 pruebas de API, lint, pruebas de pendientes con IndexedDB y la integración de migraciones en PostgreSQL aislado. También compilaron API y web. El workflow [37366077315](https://github.com/MorteiraGuarani/comercia_back/actions/runs/37366077315) confirmó la compuerta de calidad.

Las migraciones de desarrollo se aplicaron con respaldo: Comercia tiene 48 terminadas y cero fallidas pendientes. Ucheck local tiene 21. No se duplicaron roles, locales ni usuarios.

## Ucheck publicado

API Ucheck desplegada del commit `61482f97448ec67d355963b608c4a7c16c425482`, contenedor saludable y health HTTP 200. Producción tiene 21 migraciones aplicadas, incluyendo `20261006091000_seguimiento_campo`.

El APK [1.2.9, versionCode 20](http://182.160.29.45:3002/descargas/UCHECK-v1.2.9.apk) está publicado con la firma existente. SHA-256: `9ae3a6fd41df3f660a55e546524d2da660d78419e9df729267395f2bfdaaeed6`. Se verificaron firma, checksum remoto y descarga HTTP 200 de 83.234.047 bytes, incluyendo su dirección pública. La documentación completa está en el repositorio Ucheck, `docs/mejoras/entrega-seguimiento-produccion.md`.

## Despliegue de Comercia confirmado

El reintento [37381948918](https://github.com/MorteiraGuarani/comercia_back/actions/runs/37381948918) terminó correctamente: pruebas, publicación de API/web y job de despliegue. Publicó el commit `79659cf1d4d738568c71fd8f20885e9b67f28897`, que conserva la implementación del commit anterior y fija el runner.

Se confirmó desde las URLs públicas:

- Login de los dos usuarios de prueba: HTTP 200, IDs 7 y 8.
- Supervisor: seguimiento HTTP 200, con su único colaborador ID 8 y estado `SIN_DATOS`. No se insertaron ubicaciones ficticias.
- Catálogo: HTTP 200, tarea existente ID 3, versión 1, con permisos de consultar, crear, editar y archivar.
- Historial: HTTP 200, versión 1 conservada por la migración.
- Repositor: estado del teléfono HTTP 200 y `SEGUIMIENTO_DETENIDO`, con la indicación de iniciarlo en Ucheck.
- Repositor: catálogo y mapa de supervisión HTTP 403.
- Health de API y login de web: HTTP 200. El HTML de web contiene el identificador de despliegue completo `79659cf1d4d738568c71fd8f20885e9b67f28897`.

Estas consultas utilizan las columnas, permisos, tablas y datos de ambas migraciones nuevas (`20261006090000_confiabilidad_tareas` y `20261006092000_seguimiento_operativo`) y confirman que están efectivas en producción.

### Confirmación directa del 2026-10-06

Se recuperó el acceso SSH y se consultó `_prisma_migrations` directamente en ambas bases de producción:

- Comercia: **48 migraciones terminadas**, incluyendo las dos nuevas; **0 fallidas pendientes**.
- Ucheck: **21 migraciones terminadas**, incluyendo `20261006091000_seguimiento_campo`; **0 fallidas pendientes**.
- Los contenedores de API y web de Comercia y API de Ucheck están saludables.
- Las tres URLs públicas de health/login respondieron HTTP 200.

Esta verificación completa el conteo directo que había quedado pendiente por la interrupción de red. No quedó código funcional sin guardar; solo permanece estado local regenerable de Graphify.

### Incidencia resuelta por el despliegue automático

Las imágenes del primer workflow no se publicaron: GitHub canceló los trabajos al no conseguir un runner hospedado después de varios intentos. Se fija `ubuntu-24.04` para reintentar la publicación con una imagen de runner explícita.

La construcción directa de las imágenes en el servidor encontró primero un timeout de npm. Un reintento con la red del host llegó a la construcción de la web, pero se perdió la conexión SSH antes de confirmar el resultado.

Durante esa incidencia, desde la computadora de trabajo no se alcanzaba `172.19.0.140` por SSH ni por sus puertos privados de API. Se solicitó recuperar la red interna o confirmar la IP. La publicación con el runner fijado y el despliegue automático del servidor permitieron terminar la actualización; la verificación funcional se hizo por HTTPS público. El acceso SSH se recuperó para la confirmación directa del 2026-10-06. No se modificó la VPN ni la configuración de red de la computadora.

Respaldo previo de Comercia: `/opt/comercia/backups/comercia-20261006-033413.{sql.gz,uploads.tar.gz,sha256}`. Ucheck: `/opt/ucheck/backups/ucheck-20261006-033323.{sql.gz,sha256}`. Los nombres usan el reloj del servidor.

## Prueba operativa pendiente

Una visita y traslado real requieren instalar el APK nuevo, configurar las identidades Google reales, iniciar seguimiento y usar Comercia para entrada, tareas y salida. No se hizo una visita en Android físico ni se abrió un navegador para pruebas visuales.

Guía funcional: [confiabilidad y seguimiento](2026-10-05-confiabilidad-y-seguimiento.md).
