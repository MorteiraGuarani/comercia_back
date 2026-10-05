# Planificación por equipo en canal moderno

Los clientes y locales se comparten dentro de la empresa. La separación se aplica a las tareas, horarios, asignaciones y reemplazos.

| Roles | Equipo de planificación |
| --- | --- |
| Supervisor, TeamLeader, Impulsador | Impulsadores |
| SUPERVISOR_REPOSITORES, REPOSITOR | Repositores |

El equipo se deduce del rol autenticado en la API. Una tarea creada sin destinatario toma el equipo del supervisor. Enviar otro equipo o «AMBOS» se rechaza; tampoco se puede editar o eliminar una tarea del otro equipo mediante su ID. El catálogo, los contadores, las tareas de la visita, las evidencias y la supervisión respetan esa separación.

Cada equipo tiene sus propias franjas generales por local. Los horarios de una asignación tienen prioridad sobre las franjas generales de su equipo. Un horario del otro equipo no cambia la agenda ni la marcación. Los reemplazos deben pertenecer al equipo del responsable.

## Actualización de la base

Aplicar `20261005120000_planificacion_por_equipo` antes de arrancar la API actualizada. El despliegue habitual ejecuta las migraciones con Prisma.

La migración conserva los horarios generales anteriores usados por repositores mediante una copia independiente de las franjas activas. No duplica locales, asignaciones, visitas ni logs de Ucheck.

Las tareas anteriores para «AMBOS» se separan en una tarea por equipo. Los cumplimientos y borradores de los repositores pasan a su tarea, conservando fechas, fotos, comentarios y novedades. Los registros históricos de visitas y marcaciones permanecen iguales.

## Verificación

`npm run test:planificacion --workspace=api` prueba la migración y las consultas de agenda en PostgreSQL en memoria. No utiliza credenciales ni se conecta a bases de desarrollo o producción. La prueba también se ejecuta antes de publicar imágenes en el workflow Deploy.

Para revisar en teléfono: abrir planificación con cada supervisor sobre el mismo local, configurar distintas franjas y tareas, y comprobar que cada colaborador recibe únicamente las de su equipo. La cámara usa el área disponible de la pantalla móvil y conserva el encuadre completo de la fotografía.
