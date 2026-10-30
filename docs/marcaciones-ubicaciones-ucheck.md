# Marcaciones y ubicaciones: UCHECK como fuente

UCHECK es la fuente de verdad de las **marcaciones** (entrada y salida en un
local) y de los **pings de ubicación** del equipo de campo. COMERCIA no escribe
marcaciones ni pings por su cuenta: se los manda a UCHECK y los consulta con GET.
De las marcaciones COMERCIA guarda una **copia**, porque de ella cuelgan tareas,
fotos, presentismo y el resto de la operación.

Aplica a todos los roles de campo: impulsadores, TeamLeaders y repositores.

## Flujo de una marcación desde la web de COMERCIA

1. La persona toca **Marcar entrada** o **Marcar salida** en *Mi jornada → Mi
   Ruta*. El modal toma la ubicación del navegador (los repositores usan la
   última ubicación que mandó la app de UCHECK).
2. COMERCIA le manda la marca a UCHECK (`POST /comercia-integracion/marcar`).
3. UCHECK la valida en ese momento: asignación vigente en la agenda de
   COMERCIA, franja horaria, GPS dentro del radio del local, ubicación reciente
   (2 minutos como máximo) y tolerancias. Si algo no da, la rechaza y la persona
   ve el motivo. Si da bien, la guarda: desde ahí la marcación ya existe.
4. UCHECK responde con un número de operación.
5. COMERCIA pide enseguida la copia por GET y la guarda en `campo_visitas`. Casi
   siempre llega en ese mismo momento y la persona ve su visita.
6. Si la copia todavía no llegó (UCHECK lento, un corte entre servidores),
   COMERCIA anota la marca en `campo_operaciones` como **PENDIENTE**. La web
   muestra «pendiente de sincronización» y vuelve a preguntar sola. Cuando llega
   la copia, la operación pasa a **CONFIRMADA**.

Reintentar una marca no la duplica: cada marca lleva un identificador fijo
(persona + asignación + franja + día + entrada o salida).

### Qué es «pendiente de sincronización»

Va de **UCHECK a COMERCIA**: es la marcación que UCHECK ya guardó, llegando como
copia a `campo_visitas`. No significa que la marca no haya llegado a UCHECK.

### Si UCHECK no responde

La marca **no se guarda en ningún lado**: la persona ve «No se pudo conectar con
Ucheck… reintentá» y tiene que volver a marcar. COMERCIA no la guarda para
mandarla más tarde. Una cola así tendría que tratar la marca como «tomada sin
conexión» (con la hora y el GPS del momento real), porque UCHECK rechaza
ubicaciones de más de 2 minutos.

### Sincronización de copias

UCHECK ya no le envía las marcaciones a COMERCIA. COMERCIA las trae:

- cada 15 segundos y apenas alguien marca desde COMERCIA;
- con `GET /comercia-integracion/marcaciones/pendientes` (en orden, como mucho
  una por visita: la salida nunca llega antes que su entrada);
- y avisa qué guardó con `POST /comercia-integracion/marcaciones/confirmaciones`.
  Lo que falla se reintenta con espera creciente, hasta 10 veces; después queda
  como FALLIDO para revisión.

Las marcas hechas desde la app de UCHECK siguen el mismo camino: UCHECK las
guarda y COMERCIA trae la copia.

## Flujo de los pings de ubicación

- **App de UCHECK (fuente principal).** El seguimiento laboral arranca solo
  cuando la persona tiene agenda ese día en COMERCIA. Lo habilita el programa
  (`COMERCIA`, `COMERCIA_TEAMLEADER` o `COMERCIA_REPOSITOR`), no el nombre del
  rol. Corre en segundo plano con un servicio de Android y su notificación.
  - Cada posición (Android entrega una cada ~10 s, a veces en tandas) se guarda
    primero en una cola del teléfono, una cada 30 s, hasta ~16 h sin señal.
  - La cola sale en lotes de hasta 100 por `POST /comercia-seguimiento/puntos`
    con cada posición nueva, al abrir la app y al volver la red. Si falla, queda
    para el próximo intento. Un lote que UCHECK rechaza por sus datos se descarta.
  - UCHECK acepta solo puntos de la jornada de seguimiento vigente, tomados
    entre su inicio y su fin.
  - Aparte, la última posición va a `POST /comercia-seguimiento/contexto`
    (vigencia de 60 s para marcar como repositor).
  - Si Android tiene optimizada la batería de UCHECK, el punto del botón de
    seguimiento se pone ámbar y el panel explica cómo quitar la restricción.
- **Web de COMERCIA.** Toma la posición cada 30 segundos mientras está abierta
  durante la jornada y la manda a COMERCIA, que la reenvía a UCHECK
  (`POST /comercia-integracion/ubicaciones`) sin guardarla.
- UCHECK guarda un punto cada 30 segundos por persona, durante 90 días. Los
  lotes atrasados no duplican puntos ya guardados antes o después.
- El mapa en vivo (refresco cada 15 s) y el recorrido de un día o de la semana
  de COMERCIA (*Ubicaciones*) los consultan con GET (`ubicaciones/ultimas` y
  `ubicaciones/recorrido`, un pedido por día). Cada día se calcula aparte, así
  la noche no cuenta como «sin señal». En el mapa, un hueco de más de 20 min se
  dibuja punteado.

## Tablas

### En COMERCIA

| Tabla | Qué guarda | Dónde se ve | ¿Prescindible? |
|---|---|---|---|
| `campo_visitas` | La copia de cada marcación que trae de UCHECK. | Mi Ruta (visita abierta, entrada y salida), Tareas (cada tarea, foto y comentario cuelga de una visita), Presentismo (estado, horas y la pestaña *Marcaciones* de la ficha), Organigrama (el «hoy» de cada tarjeta) y Ubicaciones (locales visitados sobre el recorrido). | **No.** Es la base de la operación. |
| `campo_operaciones` | La marca que quedó pendiente: número de operación, persona, entrada o salida, la nota que escribió al marcar y el estado (PENDIENTE o CONFIRMADA). | No tiene pantalla. Solo el aviso «pendiente» del modal de marca. | **No.** UCHECK no guarda la nota: sin esta tabla se perdería. También impide desvincular una cuenta de UCHECK con marcas pendientes. |
| `campo_seguimiento` | Una fila por persona: si tiene activo el seguimiento de la app de UCHECK y su última posición, enviada por UCHECK. | Ninguna. COMERCIA solo la usa para descartar avisos viejos del mismo seguimiento. | **Sí.** Para quitarla, UCHECK deja de mandar el seguimiento y COMERCIA quita el endpoint que lo recibe y borra la tabla. |
| `campo_ubicaciones` | Pings guardados mientras COMERCIA los escribía directo. | — | Se borra con la migración `20261026130000_drop_campo_ubicaciones`. |

### En UCHECK

| Tabla | Qué guarda |
|---|---|
| `comercia_asignaciones_cache` / `comercia_locales_cache` | La agenda y los locales de COMERCIA con los que se valida cada marca. |
| `jornadas` | La jornada de la persona. |
| `comercia_visitas` | La marcación original: la fuente. |
| `integracion_outbox` | Lo que COMERCIA todavía no tomó: pendiente, procesado o fallido. |
| `comercia_ubicaciones` | Los pings de ubicación (fuente única). |
| `seguimiento_campo` | Estado y última posición del seguimiento de la app de UCHECK. |

## Módulos que participan

**Web de COMERCIA**

- `components/campo/jornada-panel.tsx`: Mi Ruta, desde donde se marca.
- `components/campo/modal-marca.tsx`: toma la ubicación, manda la marca y, si
  queda pendiente, consulta hasta que se confirma.
- `components/campo/emisor-ubicacion.tsx`: manda los pings durante la jornada.

**API de COMERCIA**

- `campo/campo.controller.ts` y `campo/repositor-campo.service.ts`: reciben la
  marca (`POST /campo/jornada/entrada`, `.../visitas/:id/salida` y las variantes
  de repositor), se la mandan a UCHECK, guardan la operación pendiente y
  responden su consulta (`GET /campo/jornada/repositor/operaciones/:id`, para
  todos los roles).
- `ucheck/`: `UcheckClienteService` (cliente HTTP hacia UCHECK) y
  `UcheckSincronizacionService` (aviso de «traé la copia ya»).
- `integraciones-ucheck/sincronizacion-marcaciones.service.ts`: GET de pendientes,
  copia en `campo_visitas` (con `IntegracionesUcheckService.registrarMarcacion`),
  confirmación de la operación y de la nota, y aviso a UCHECK.
- `ubicaciones/ubicaciones.service.ts`: reenvía los pings y consulta el mapa en
  vivo y el recorrido a UCHECK.
- `usuarios/vinculos-ucheck.service.ts`: no deja desvincular una cuenta con
  marcas pendientes.

**API de UCHECK (módulo `comercia`)**

- `comercia-integracion.controller.ts`: `marcar`, `marcaciones/pendientes`,
  `marcaciones/confirmaciones`, `ubicaciones`, `ubicaciones/ultimas` y
  `ubicaciones/recorrido`. Solo entre servidores, con la credencial de
  integración.
- `comercia-repositor.service.ts` (`marcar`): identifica a la persona, toma la
  ubicación (navegador o app) y busca la asignación en la agenda.
- `comercia.service.ts` (`marcar`): valida GPS, franja y tolerancias y guarda.
- `comercia-outbox.service.ts`: entrega los pendientes y aplica las
  confirmaciones.
- `ubicaciones-comercia.service.ts`: guarda y consulta los pings.

## Requisitos y despliegue

- Cada persona que marca desde COMERCIA necesita una cuenta en UCHECK (vinculada
  o con el mismo correo) con un programa de COMERCIA habilitado. Sin ella no
  puede marcar.
- Desplegar **primero UCHECK y después COMERCIA**. Al revés, COMERCIA llamaría
  endpoints que todavía no existen y las marcas desde la web fallarían. En ese
  orden no se pierde nada: lo marcado mientras tanto queda en UCHECK hasta que
  COMERCIA lo traiga.
- Las visitas abiertas antes de este cambio (sin pasar por UCHECK) se cierran
  como antes, en COMERCIA.
