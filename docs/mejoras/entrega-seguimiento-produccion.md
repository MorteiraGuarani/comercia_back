# Registro de entrega y producción

Fecha de trabajo: 2026-10-05.

## Código y verificaciones

La implementación de Comercia se publicó en el commit `6abe7feb4fdfff2cc2ac62eea106a1ac3f2266fc`. Pasaron 184 pruebas de API, lint, pruebas de pendientes con IndexedDB y la integración de migraciones en PostgreSQL aislado. También compilaron API y web. El workflow [37366077315](https://github.com/MorteiraGuarani/comercia_back/actions/runs/37366077315) confirmó la compuerta de calidad.

Las migraciones de desarrollo se aplicaron con respaldo: Comercia tiene 48 terminadas y cero fallidas pendientes. Ucheck local tiene 21. No se duplicaron roles, locales ni usuarios.

## Ucheck publicado

API Ucheck desplegada del commit `61482f97448ec67d355963b608c4a7c16c425482`, contenedor saludable y health HTTP 200. Producción tiene 21 migraciones aplicadas, incluyendo `20261006091000_seguimiento_campo`.

El APK [1.2.9, versionCode 20](http://172.19.0.140:3002/descargas/UCHECK-v1.2.9.apk) está publicado con la firma existente. SHA-256: `9ae3a6fd41df3f660a55e546524d2da660d78419e9df729267395f2bfdaaeed6`. Se verificaron firma, checksum remoto y descarga HTTP 200 de 83.234.047 bytes. La documentación completa está en el repositorio Ucheck, `docs/mejoras/entrega-seguimiento-produccion.md`.

## Incidencia de despliegue de Comercia

Las imágenes del primer workflow no se publicaron: GitHub canceló los trabajos al no conseguir un runner hospedado después de varios intentos. Se fija `ubuntu-24.04` para reintentar la publicación con una imagen de runner explícita.

La construcción directa de las imágenes en el servidor encontró primero un timeout de npm. Un reintento con la red del host llegó a la construcción de la web, pero se perdió la conexión SSH antes de confirmar el resultado.

En la última comprobación, `https://app.comercia.pro/login` responde HTTP 200, pero desde la computadora de trabajo no se alcanza `172.19.0.140` por SSH ni por sus puertos de API. Se solicitó recuperar la red interna o confirmar la IP. **El despliegue de Comercia y sus dos migraciones nuevas en producción todavía no están confirmados.** Este registro se actualizará con los resultados reales al recuperar el acceso o completar el despliegue automático.

Respaldo previo de Comercia: `/opt/comercia/backups/comercia-20261006-033413.{sql.gz,uploads.tar.gz,sha256}`. Ucheck: `/opt/ucheck/backups/ucheck-20261006-033323.{sql.gz,sha256}`. Los nombres usan el reloj del servidor.

## Prueba operativa pendiente

Una visita y traslado real requieren instalar el APK nuevo, configurar las identidades Google reales, iniciar seguimiento y usar Comercia para entrada, tareas y salida. No se hizo una visita en Android físico ni se abrió un navegador para pruebas visuales.

Guía funcional: [confiabilidad y seguimiento](2026-10-05-confiabilidad-y-seguimiento.md).
