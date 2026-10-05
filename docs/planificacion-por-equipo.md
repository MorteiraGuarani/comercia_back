# Planificación por equipo en canal moderno

Los clientes y locales se comparten dentro de la empresa. La separación se aplica a las tareas, horarios, asignaciones y reemplazos, mediante el **equipo operativo configurado en cada rol**.

| Roles | Equipo de planificación |
| --- | --- |
| Supervisor, TeamLeader, Impulsador | Impulsadores |
| SUPERVISOR_REPOSITORES, REPOSITOR | Repositores |

La tabla anterior muestra la configuración inicial de los roles existentes. Los nombres de los roles nuevos no se interpretan ni se utilizan como criterio de aislamiento.

En Administración > Roles se puede seleccionar un equipo existente, crear uno nuevo o dejar el rol sin planificación de campo. El supervisor y sus colaboradores deben pertenecer al mismo equipo. Los permisos de módulos y páginas se configuran aparte: pertenecer a un equipo no concede permisos.

Equipos diferentes no comparten tareas ni horarios, incluso si ambos son de impulsadores o ambos de repositores. Los roles dentro de un mismo equipo sí comparten la planificación de ese equipo. Un rol sin equipo operativo activo no puede consultar ni crear planificación y no hereda la de otros roles.

Una tarea creada sin destinatario toma el tipo y el ID de equipo del supervisor autenticado. Enviar otro equipo o «AMBOS» se rechaza; tampoco se puede editar o eliminar una tarea del otro equipo mediante su ID. El catálogo, los contadores, las tareas de la visita, las evidencias y la supervisión respetan esa separación. Renombrar el rol no cambia su equipo. Para cambiar de equipo, primero deben cerrarse las visitas abiertas de sus usuarios.

Cada equipo tiene sus propias franjas generales por local. Los horarios de una asignación tienen prioridad sobre las franjas generales de su equipo. Un horario del otro equipo no cambia la agenda ni la marcación. Los reemplazos deben pertenecer al equipo del responsable.

## Actualización de la base

Aplicar `20261005120000_planificacion_por_equipo` y luego `20261005160000_equipos_operativos_configurables` antes de arrancar la API actualizada. El despliegue habitual ejecuta las migraciones con Prisma.

La migración conserva los horarios generales anteriores usados por repositores mediante una copia independiente de las franjas activas. No duplica locales, asignaciones, visitas ni logs de Ucheck.

Las tareas anteriores para «AMBOS» se separan en una tarea por equipo. Los cumplimientos y borradores de los repositores pasan a su tarea, conservando fechas, fotos, comentarios y novedades. Los registros históricos de visitas y marcaciones permanecen iguales.

La segunda migración guarda los equipos existentes por empresa y vincula sus tareas, horarios y roles conocidos. Los roles anteriores con nombres desconocidos quedan sin equipo hasta que se configuren explícitamente. No se duplican roles ni locales.

## Verificación

`npm run test:planificacion --workspace=api` prueba la migración y las consultas de agenda en PostgreSQL en memoria. No utiliza credenciales ni se conecta a bases de desarrollo o producción. La prueba también se ejecuta antes de publicar imágenes en el workflow Deploy.

Para revisar en teléfono: abrir planificación con cada supervisor sobre el mismo local, configurar distintas franjas y tareas, y comprobar que cada colaborador recibe únicamente las de su equipo. La cámara usa el área disponible de la pantalla móvil y conserva el encuadre completo de la fotografía.
