# Confiabilidad y seguimiento operativo

Fecha: 2026-10-05. Implementación terminada y publicada en producción. Las verificaciones y limitaciones se registran en `entrega-seguimiento-produccion.md`.

## Alcance aprobado

1. Archivar tareas y conservar las versiones utilizadas, cumplimientos y evidencias.
2. Mostrar en Comercia la antigüedad y el estado conocido del teléfono en Ucheck.
3. Distinguir marcaciones confirmadas, pendientes de sincronización y rechazadas.
4. Configurar permisos de consultar, crear, editar y archivar tareas por rol.
5. Administrar y comprobar la vinculación de usuarios entre Comercia y Ucheck.
6. Conservar borradores, fotos y acciones de tareas ante pérdidas de conexión.
7. Ofrecer seguimiento operativo y alertas de visitas, tareas y sincronización.
8. Usar selectores remotos paginados y mejorar la operación móvil.
9. Invalidar contexto al cerrar sesión y ajustar seguimiento y consumo de batería.
10. Agregar un mapa actualizado para supervisores con sus colaboradores, local, visita y actividad registrada.

## Reglas de la entrega

- Locales compartidos por empresa; planificación y alcance separados por equipo y cadena de superiores.
- El mapa muestra ubicaciones reportadas con fecha y precisión. Una ubicación antigua nunca se presenta como ubicación actual confirmada.
- Los supervisores acceden solo a su personal autorizado. Un TeamLeader o colaborador no recibe ubicaciones de otros equipos.
- El resumen muestra la última actividad registrada en tareas; no afirma que una persona esté ejecutando una tarea sin una actividad registrada.
- La entrada y salida del repositor se confirman en Comercia usando contexto válido de Ucheck.
- Los pendientes locales se muestran como pendientes y solo se confirman después de la respuesta del servidor.
- Las comprobaciones usan revisión de código, pruebas puntuales, compilación y consultas HTTP. No se abre un navegador.

## Uso del mapa

1. En Ucheck, el colaborador inicia sesión e inicia **Seguimiento laboral**. Debe conceder ubicación precisa y permiso para ubicación en segundo plano.
2. En Comercia, el supervisor abre **Gestión de campo → Seguimiento en vivo**. Ve su cadena real de colaboradores dentro de su empresa y equipo operativo.
3. Ucheck solicita GPS aproximadamente cada 10 segundos durante la jornada. El mapa consulta cada 5 segundos mientras la pantalla está visible y hay conexión. El marcador se anima entre dos posiciones realmente recibidas; no se inventa una posición sobre una calle.
4. El listado y el mapa comparten búsqueda y paginación (7, 15 o 30 colaboradores). El mapa muestra los colaboradores de la página actual. No descarga todo el personal de la empresa.
5. Se muestra antigüedad, precisión, seguimiento finalizado/desactualizado, visita abierta, local, progreso y última actividad registrada de tarea. Verde significa reporte reciente; gris, último punto vencido. El umbral es 60 segundos. Los contadores incluyen visitas abiertas y marcaciones pendientes.
6. Al terminar su jornada, el colaborador finaliza el seguimiento en Ucheck. Esto detiene GPS y retira las coordenadas del estado compartido. No cierra automáticamente una visita.

Las consultas iniciadas por el usuario (Actualizar, búsqueda y paginación) muestran el backdrop global **Actualizando seguimiento** hasta terminar. Actualizar bloquea clics repetidos y confirma el éxito con un aviso. Ante falta de conexión, error o una espera de 15 segundos, la pantalla de carga se cierra y se muestra el error. Las consultas periódicas del mapa mantienen el seguimiento en segundo plano.

El mismo backdrop se aplica a Comprobar Ucheck, consultar el historial y sus páginas, sincronizar pendientes, cargar/enviar comentarios y marcarlos como leídos. Cada procedimiento indica su acción y libera la pantalla de carga al terminar o fallar. Los reintentos automáticos de ubicaciones y pendientes siguen en segundo plano.

Los mapas contienen sus capas, marcadores y controles flotantes en un contexto propio. Al abrir el perfil u otro modal, el mapa queda detrás del fondo oscurecido y no intercepta sus clics. La misma regla se aplica a Seguimiento en vivo, cobertura de clientes, mapa de un local y selección de ubicación. El desplegable de clientes también queda debajo de los modales.

La frecuencia efectiva depende del GPS, conexión y restricciones de Android. Usar ubicación precisa durante una jornada consume batería. La app muestra una notificación de servicio; el usuario puede finalizar el seguimiento. Una app forzada a detenerse no garantiza nuevas ubicaciones. Si pierde red, se muestra el último reporte como desactualizado. Esta entrega conserva el último punto operativo, sin un historial de recorridos ni predicción de rutas.

## Permisos y equipos nuevos

En **Administración → Roles**, el superadministrador configura por separado:

- Empresa, equipo operativo y relación entre roles.
- Permisos de tareas: consultar, crear, editar y archivar. Las operaciones de administración requieren también consultar.
- Permiso para ver seguimiento y acceso a la página correspondiente en Gestión de campo.
- Superior real de cada persona en Usuarios.

La migración concede los cuatro permisos de tareas y seguimiento a los supervisores existentes. TeamLeader conserva solo consulta del catálogo; Impulsador y Repositor ejecutan sus tareas asignadas sin ABM. Un rol nuevo empieza sin capacidades hasta configurarlo. Renombrar un rol conserva sus permisos y su equipo. Tener una página habilitada no permite eludir los permisos de la API.

Los locales siguen siendo únicos y compartidos por empresa. Tareas, horarios, titulares y reemplazos siguen separados por el ID de equipo; dos equipos distintos del mismo tipo también se mantienen separados.

## Tareas, versiones y evidencias

- La acción **Archivar** desactiva la tarea sin borrar cumplimientos, fotos, comentarios ni novedades. Hay filtros para activas, archivadas y todas.
- Cada alta, edición y archivo guarda una versión consultable desde **Historial**. Una edición con versión desactualizada se rechaza para evitar sobrescribir cambios ajenos.
- **Empezar tarea**, una foto o un comentario registran la versión de instrucciones que el colaborador empezó a usar. Esa versión se conserva durante la ejecución aunque después se edite o archive el catálogo.
- Completar una tarea ya confirmada devuelve su confirmación sin crear un segundo cumplimiento. Las fotos y comentarios enviados desde la cola usan identificadores de operación para reconocer reintentos.
- La actividad del mapa expresa lo registrado en el servidor. No asegura que una persona continúe trabajando si no hay una acción nueva.

## Teléfono y confirmación de visitas

En **Mis locales**, el repositor ve la última ubicación conocida de Ucheck, su precisión y mensajes de cuenta no habilitada, seguimiento detenido, contexto vencido o falta de conexión.

Las visitas del repositor se marcan en Comercia. Ucheck aporta el contexto completo del dispositivo y guarda el evento; ambos servidores sincronizan la visita. Si la sincronización sigue pendiente, Comercia conserva el identificador de operación y ofrece **Consultar confirmación**. Esa consulta no repite una entrada o salida y no exige una muestra GPS nueva para consultar lo que ya se guardó. Una respuesta perdida de red no se presenta como guardado confirmado: hay que comprobar el estado antes de volver a marcar.

## Vinculación de identidades

El superadministrador abre un usuario existente en Usuarios y utiliza **Vinculación con Ucheck** para comprobar correo, identidad, empresa y programas activos. Debe revisar la cuenta mostrada antes de vincularla. El vínculo usa el identificador estable de Ucheck y resiste cambios de correo posteriores.

Una identidad no puede vincularse a dos usuarios de Comercia. Desvincular requiere visitas cerradas y ninguna marcación pendiente. Además retira el punto y deshabilita la vinculación automática; solo un administrador puede volver a habilitar el vínculo. Los dos usuarios de prueba existentes se conservan. Las cuentas de Google reales deben configurarse antes de la prueba en teléfono.

## Trabajo con conexión intermitente

La pantalla de tareas conserva en IndexedDB los borradores de comentarios y la cola de inicio, fotos, comentarios y completado. Primero guarda la acción en el dispositivo; después intenta enviarla. **Pendiente de envío** es diferente de confirmado. Al volver la red reintenta con la misma operación y en orden.

- Cada cuenta ve y envía únicamente sus pendientes; se comprueba la sesión antes de sincronizar.
- Un rechazo de negocio conserva la acción como **Revisar** y bloquea solo las acciones posteriores de esa tarea. Se puede revisar, reintentar o descartar de forma explícita.
- Hay un límite de 100 acciones pendientes y mensajes de falta de espacio. No borrar los datos del sitio ni descartar evidencias que todavía se necesiten.
- Esta entrega permite seguir trabajando en una página de tareas ya cargada al perder conexión. No incorpora un caché completo para abrir páginas nuevas sin red. Entradas y salidas de visitas requieren conexión y contexto válido.

Los selectores de clientes y locales realizan búsqueda remota paginada. Al editar se recuperan todas las selecciones existentes por páginas para no perder locales que no estén en la primera página. Las pantallas nuevas tienen disposición móvil y tema claro/oscuro.

## Migraciones y verificaciones

Comercia:

- `20261006090000_confiabilidad_tareas`: permisos de roles, archivo/versiones y evidencias con operación.
- `20261006092000_seguimiento_operativo`: estado de seguimiento, operaciones pendientes, control de vinculación y página de mapa.

Ucheck: `20261006091000_seguimiento_campo`.

Se aplicaron en desarrollo con respaldo previo. Comercia local usa 5433; Ucheck local, 5436 para evitar el conflicto entre bases. Se crearon respaldos de ambas bases de producción y de uploads de Comercia antes del despliegue.

Verificaciones: 184 pruebas de API Comercia, 93 de API Ucheck, migraciones en PostgreSQL aislado, cola de tareas con IndexedDB simulado sin navegador, permisos/cancelación del seguimiento móvil, compilación de APIs y web, typecheck móvil y APK firmado. El lint de los archivos modificados pasó; el lint general de Ucheck conserva errores anteriores ajenos a esta entrega. No se realizaron pruebas visuales ni una visita en Android físico.

Para probar en teléfono: instalar APK 1.2.9, configurar las identidades reales, asignar local/horario/tareas al repositor, iniciar seguimiento y verificar el mapa durante un traslado. Marcar entrada en Comercia, comenzar tarea, subir evidencias, completar y dar salida. Cortar la conexión para comprobar los pendientes y recuperarla para confirmar. Finalizar seguimiento al terminar.
