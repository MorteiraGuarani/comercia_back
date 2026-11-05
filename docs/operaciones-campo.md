# Operaciones de campo

Implementación común para impulsadores, repositores y otros roles. Las rutas de
plataforma identifican funciones; los nombres de rol no participan en la autorización.

- **Gestión de campo** (`gestion-campo`): clientes, locales, tareas y presencias
  del equipo. Asignaciones y backups solo para subordinados directos del usuario.
- **Mi jornada** (`mi-jornada`): locales y tareas por fecha, entrada y salida.
  Cada usuario consulta únicamente sus asignaciones efectivas y sus presencias.
- Clientes, locales y tareas pertenecen al catálogo de la empresa. Los responsables
  con permisos pueden administrarlo; la restricción de equipo se aplica a personas,
  asignaciones y presencias.

## Configuración

Aplicar `20260908140000_operaciones_campo` con `prisma migrate deploy` al destino
correcto antes de iniciar el backend actualizado, y generar el cliente Prisma.
La migración crea tablas nuevas y configura ambos módulos para la empresa Guaraní:
TeamLeader recibe Gestión de campo e Impulsador recibe Mi jornada si esos roles
ya existen. No modifica asignaciones de módulos preexistentes.

Para repositores: habilitar los mismos módulos desde Administración → Accesos
de empresas, seleccionando TeamLeader Repositor y Repositor respectivamente.
Configurar el superior de cada usuario en Usuarios. No hace falta duplicar páginas,
tablas ni servicios. Con permisos por página, habilitar Clientes junto con Locales
cuando el responsable deba también modificar clientes.

## Reglas operativas

- Un local pertenece a un cliente; conserva dirección, contacto, coordenadas y notas.
- Las bajas son desactivaciones y preservan el historial.
- Una tarea aplica a todos los locales por defecto, incluidos los creados después.
  Alternativamente se seleccionan hasta 50 locales de la empresa por tarea.
  Durante su vigencia se presenta en cada visita; no es obligatoria para marcar salida.
- Horarios en `America/Asuncion`: diarios, semanales o mensuales, cada N períodos.
  La fecha desde fija el inicio; las semanas comienzan el lunes. Días mensuales que
  no existen se omiten. Cada franja es una visita; máximo 20 franjas activas por local.
  El rango de atención debe terminar en el mismo día. Sin horarios se permite una
  visita diaria. Editar una franja crea una versión nueva y conserva la anterior.
- La asignación tiene vigencia. El backup reemplaza al titular en fechas inclusivas
  desde/hasta; no se admiten backups superpuestos en una asignación.
- Se guarda quién asistió realmente, el titular y si era un backup. Se permite una
  marcación por asignación/franja/día. Una persona puede tener varias visitas
  abiertas en distintos locales: entra a otro sin cerrar el anterior y puede volver
  a marcar esa salida después; la que no cierra queda incompleta al terminar su franja.
- La entrada se valida contra la fecha/hora del servidor y las franjas del día.
  La salida sigue disponible aunque termine el horario o se desactive la asignación.
- GPS se solicita al marcar. Si no está disponible se exige un motivo; las
  coordenadas se registran pero no se exige una distancia máxima al local.
- Los mapas se cargan al abrirlos con OpenStreetMap; existe un enlace a Maps.

## Validación

Compilación del monorepo y pruebas puntuales de calendario y alcance. No requiere
pruebas de navegador por defecto. La ejecución de la migración en PostgreSQL debe
validarse antes de desplegar; no usar `migrate dev` contra producción.
