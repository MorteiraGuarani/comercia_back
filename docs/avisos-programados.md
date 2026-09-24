# Avisos programados

En «Avisos» se puede enviar inmediatamente o programar un comunicado. El alcance puede ser todo el equipo activo o una selección de uno o varios subordinados. El selector busca y pagina en la API; el servidor vuelve a validar el alcance al guardar.

## Frecuencias

- **Una vez:** fecha y hora.
- **Cada ciertas horas:** intervalo de 1 a 168 horas desde la primera fecha y hora.
- **Diaria:** una vez por día a la hora elegida.
- **Semanal:** uno o varios días de la semana a la hora elegida.
- **Mensual:** día del mes y hora. Si se elige 29, 30 o 31 y el mes es más corto, se usa el último día.

La hora se interpreta siempre en `America/Asuncion`. Las repeticiones admiten una fecha final opcional. Sin fecha final siguen hasta que el emisor pulse «Cancelar» en la pestaña «Programados». Un envío único pasa a inactivo después de entregarse.

## Persistencia y entrega

La regla, el siguiente envío, los destinatarios elegidos y el mensaje se guardan en PostgreSQL (`campo_aviso_programaciones`). Las fotos se guardan en el volumen persistente de uploads y sus metadatos en `campo_adjuntos`; véase [almacenamiento-en-produccion.md](almacenamiento-en-produccion.md). Reiniciar o reemplazar el contenedor no borra la programación.

La API consulta programaciones vencidas al arrancar y cada 30 segundos. Cada instancia intenta reservar el mismo registro mediante una actualización condicional dentro de una transacción. El avance del próximo envío, la creación del aviso, sus destinatarios, referencias a las fotos y las notificaciones se confirman juntos. Si falla la transacción, el envío queda pendiente para el siguiente intento. Tras una interrupción se envía una vez el aviso vencido; las repeticiones antiguas no se acumulan en ráfaga.

Para «todo el equipo», los destinatarios activos se calculan al enviar. Para una selección, solo reciben quienes todavía pertenecen al equipo activo del emisor. Cada aviso **nuevo** guarda la lista concreta de destinatarios (`campo_aviso_destinatarios`), de modo que lecturas y permisos de imágenes no cambian al reorganizar el equipo. Los avisos antiguos conservan la regla de acceso anterior porque no se puede reconstruir con certeza quién pertenecía al equipo en la fecha original. Las programaciones del usuario solo se pueden listar y cancelar con su sesión autenticada.

La migración `20260924120000_avisos_programados_y_destinatarios` debe aplicarse antes de iniciar la API con esta función. Si la API no está en ejecución, los avisos vencidos se entregan cuando vuelva a arrancar.
