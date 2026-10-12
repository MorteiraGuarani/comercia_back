# Local principal del colaborador

Especificación funcional del producto, no instrucciones para agentes.

Desde Locales → Gestionar → Equipo se puede marcar una asignación titular como Principal. Cada usuario conserva un único local principal; elegir otro reemplaza al anterior y pulsar el seleccionado quita la preferencia. La asignación debe estar activa, no vencida, dentro de la empresa y del equipo administrado. No crea asignaciones ni modifica horarios.

PUT `/campo/asignaciones/:id/principal` recibe `{ "principal": true }` o false. Usa la misma autorización que la planificación del colaborador. La preferencia se limpia al quitar la última asignación activa del local.

La agenda devuelve `esPrincipal` y lo prioriza antes de paginar. La integración con UCHECK conserva la bandera en la caché por usuario y fecha. La app la usa antes del orden por estado/distancia, manteniendo filtros y marcaciones sin conexión. La preferencia es independiente de Uweb.

Migración aditiva: `20261012190000_local_principal`. Aplicada en producción el 12 de octubre de 2026, con respaldo previo. API y web desplegadas, saludables y fijadas a `legajo-principal-20261012T191000Z`.
