# Tolerancias de horarios

Se configuran en minutos, por parámetro. Prioridad: **usuario > horario > empresa > global > valores iniciales**. Un campo vacío/null hereda; cero es un valor propio válido. Cada sistema tiene su configuración global y sus empresas.

| Parámetro | Inicial | Regla |
| --- | ---: | --- |
| anticipoEntrada | 60 | Entrada desde 60 minutos antes del inicio en verde. Antes, rojo. |
| toleranciaEntrada | 14 | Entrada hasta 14 minutos después del inicio en verde. |
| limiteEntrada | 30 | Entrada desde el minuto 15 hasta el 30 en amarillo; luego rojo. |
| toleranciaSalidaAntes | 14 | Salida desde 14 minutos antes del fin en verde. Antes, rojo. |
| toleranciaSalidaDespues | 14 | Salida hasta 14 minutos después del fin en verde. |
| limiteSalida | 59 | Salida desde el minuto 15 hasta el 59 en amarillo; luego rojo. |

Los límites incluyen el minuto indicado: con tolerancia 14, el minuto 15 inicia el amarillo. Los valores admiten enteros de 0 a 1440; el límite amarillo debe ser al menos su tolerancia verde. La marcación fuera de tolerancia se registra y clasifica; se mantienen las validaciones de identidad, fecha, GPS y alcance.

## Configuración

Si un cambio en un nivel superior hace que una tolerancia verde supere un límite amarillo propio de otro nivel, el límite efectivo se eleva hasta esa tolerancia verde. Nunca se clasifica como rojo un minuto admitido en verde. La respuesta incluye estos límites efectivos; guardar límites explícitamente invertidos se rechaza.

- **Comercia:** Administración → Empresas para global y empresa (superadmin). En locales, cada franja tiene “Tolerancias de esta franja”. En los horarios de un colaborador se configura “Tolerancias de este usuario”; los gestores solo acceden a su empresa y equipo.
- **UWeb:** Locales → Tolerancias para empresa y global (global solo superadmin). Editar un plan permite personalizar sus tolerancias. Usuarios → Locales permite configurar las del usuario.
- En UWeb, el ámbito `horario` identifica el **plan** y aplica a sus turnos y a sus horarios personalizados; el valor del usuario prevalece.
- Cada bloque guarda sus tolerancias mediante su propio botón. “Heredar todos” prepara la eliminación de los valores propios; se confirma al guardar.
- Los minutos heredados mostrados para un usuario corresponden a global/empresa. En una visita también se consideran los valores del horario correspondiente.

## Historial y jornada

Al aceptar la entrada se guarda la copia de los seis valores efectivos. La salida usa esa copia. Editar la configuración no recalifica visitas iniciadas ni cerradas. Las visitas históricas sin copia conservan su evaluación y cálculo anteriores. Versionar una franja de Comercia copia sus tolerancias a la nueva versión.

La hora real de entrada/salida se conserva. El tiempo computable es la intersección de la permanencia real con el horario previsto. Llegar antes o quedarse después no aumenta esos minutos; tampoco se inventan entradas o salidas. El estado funcional (Presente, Tarde, Incompleto, Ausente) se conserva junto con el color de cada marcación; por ejemplo, una visita completa puede tener una salida amarilla. La app muestra los colores en su historial y mantiene separadas las alertas del local.

## Integración y despliegue

Comercia envía las tolerancias efectivas en la agenda a UCheck, que las conserva en la caché y las fija al aceptar la entrada. El evento de sincronización devuelve esa copia a Comercia. Las marcaciones de Comercia usan sus reglas, independientemente de las de UWeb.

Se agregan la tabla `configuraciones_tolerancia` y campos opcionales en visitas mediante la migración `20261015140000_tolerancias_horario`, sin actualizar registros anteriores.

Al publicar: desplegar primero la API de Comercia y después la de UCheck con sus migraciones; publicar las webs y actualizar la app para mostrar los tres colores. No hace falta modificar los parámetros de cada usuario: heredan hasta que se personalicen.

Contratos:
- Comercia: GET/PUT `/api/v1/campo/tolerancias/{alcance}/{id}`.
- UWeb: GET/PUT `/api/v1/admin/uweb/tolerancias/{alcance}/{id}`.
- `alcance`: global, empresa, horario o usuario; `id=0` para global.
- En UWeb el superadmin envía `?empresaId=...` para horario/usuario.
- PUT reemplaza los valores propios del ámbito y devuelve `valores`, `heredados` y `efectivos`.
