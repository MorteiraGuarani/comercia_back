# Jornadas vencidas y estados de presentismo

Una visita con entrada el 9 de octubre y sin salida no puede seguir activa el 10.
Se conserva la entrada y `salida: null`; el cierre es virtual y no genera una
marcación ni modifica las marcas históricas.

## Reglas

- La actividad operativa requiere fecha de hoy en Paraguay y salida vacía.
  Al cambiar de día queda `INCOMPLETA`, desaparece de la visita activa y deja de
  bloquear otra entrada. Las APIs rechazan una salida nueva, inicio/completado
  de tareas y carga de evidencias sobre la jornada vencida.
- Presentismo usa las reglas de `UCHECK/apps/api/src/uweb/utils/estado-presentismo.ts`:
  `SIN_REGISTRO`, `PRESENTE`, `TARDE`, `INCOMPLETO`, `AUSENTE`. Las comparaciones
  tienen precisión de minutos y usan la zona del local.
- Con horario: ausencia al vencer sin marcas; incompleto si vence sin salida o
  hay salida anticipada; tarde si la entrada supera el minuto de inicio.
  Sin horario no se deduce ausencia ni tardanza; una entrada sin salida de un
  día anterior es incompleta.
- La evaluación de presentismo y la posibilidad de operar son datos distintos:
  un turno de hoy vencido sin salida es incompleto para presentismo; la salida
  real puede registrarse durante ese mismo día. Una jornada anterior no admite
  una salida nueva.
- En períodos y varios locales se priorizan incidencias: Incompleto, Ausente,
  Tarde, Presente y Sin registro. Una visita vigente conserva su actividad aunque
  el período también incluya incidencias históricas.
- Los contadores de ruta cuentan locales por estado y separan incompletas y
  ausentes de las pendientes. Ruta, Mis locales, Tareas, historial y la ficha del
  colaborador consumen los estados calculados por la API.
- UCheck busca y bloquea visitas abiertas únicamente de la misma fecha. La hora
  oficial valida el día de entrada/salida. Una captura offline válida puede
  sincronizarse más tarde y conserva su hora original.
- Las pantallas con filtro Hoy cambian de fecha también si permanecen abiertas.
  El reloj local no consulta la API periódicamente; vuelve a cargar al cambiar
  de día. La API conserva la validación aunque el teléfono tenga una pantalla
  desactualizada.

## Despliegue

Comercia requiere aplicar la migración `20261014120000_visita_abierta_por_fecha`
y desplegar su API/web. Sustituye el índice parcial de usuario por uno de
`(usuario_id, fecha)`, manteniendo la protección de concurrencia y las visitas
anteriores sin salida. No requiere rellenar salidas ni migrar marcas.

También se debe desplegar la API de UCheck para que el circuito móvil permita
una nueva entrada cuando existe una visita vencida. No cambia sus tablas.

## Verificación

Pruebas puntuales de estados, medianoche local frente a UTC, límites del turno,
horarios históricos de UCheck, vigencia de asignación, rangos, supervisión,
salidas y evidencias. La migración se comprueba en PostgreSQL en memoria con
PGlite: permite días distintos sin salida, rechaza duplicados del mismo día y
conserva la marca anterior intacta. Incluye pruebas del circuito móvil y
Swagger en UCheck, compilación de APIs y comprobación TypeScript de la web.

Revisión de UI por código: componentes y tokens existentes, claro/oscuro,
filtros adaptables y listas móviles. Revisión visual pendiente por preferencia
del usuario de no abrir navegadores.
