# Supervisor, TeamLeader y visitas en UCHECK

## Jerarquía

En cada empresa, el rol `SUPERVISOR` está encima de `TeamLeader` y comparte las páginas de `Gestión de campo`. Un Supervisor puede tener varios TeamLeaders. Cada TeamLeader tiene sus impulsadores o repositores asignados mediante `usuarios.superior_id`. La relación entre personas se configura en **Usuarios → Superior**, no se deduce del nombre del rol. La relación entre roles define qué tipo de superior se puede elegir.

El resumen **Presentismo** muestra al Supervisor los colaboradores de toda su cadena de mando y, cuando tiene TeamLeaders directos, KPI adicionales sobre sus visitas propias. Las evidencias, novedades y avisos usan la misma cadena real de superiores para autorizar el acceso. Un Supervisor no ve el equipo de otro Supervisor por compartir rol.

## Ruta del TeamLeader

La agenda del TeamLeader se calcula cada día desde las asignaciones vigentes de sus colaboradores **directos**. Hereda el local y sus horarios actuales, sin crear otra asignación ni copiar el catálogo de locales. Si varios colaboradores tienen el mismo local, se presenta una sola parada por local. La visita que marca el TeamLeader es independiente de la visita del impulsador: conserva su propio usuario, entrada, salida y ubicación, vinculadas a la asignación original como referencia. El TeamLeader no completa automáticamente las tareas del impulsador.

UCHECK ofrece el programa `COMERCIA_TEAMLEADER` como **Comercia TeamLeader**. La empresa debe tener ese programa y cada TeamLeader debe recibirlo en la administración de UCHECK. El módulo usa la misma integración servidor a servidor y las mismas tablas de caché/visitas de Comercia que el programa de impulsadores; no hay un segundo catálogo de locales. La APK muestra al impulsador titular de cada parada. Al quitar o cambiar una asignación en COMERCIA, la siguiente sincronización de agenda refleja el cambio.

Para dar de alta a otro TeamLeader: crear o actualizar su usuario en COMERCIA con rol `TeamLeader`, elegir su Supervisor como superior, asignar los impulsadores con ese TeamLeader como superior, y otorgarle `COMERCIA_TEAMLEADER` en UCHECK. El correo de ambas plataformas debe coincidir. El programa se registra por migración en UCHECK y se asigna a las empresas que ya tenían `COMERCIA`.

## Despliegue

Aplicar primero la migración y API de COMERCIA; después la migración y API de UCHECK; por último distribuir la APK **1.2.6** (código Android **17**). La web de COMERCIA muestra los KPI en `Gestión de campo → Presentismo`. La distribución de un APK requiere que cada teléfono instale la actualización; cambiar solo los contenedores no modifica la aplicación instalada.
