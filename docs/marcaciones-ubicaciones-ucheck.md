# Marcaciones y ubicaciones: UCHECK como fuente

UCHECK es la fuente de verdad de las **marcaciones** (entrada y salida en un
local) y de los **pings de ubicación** del equipo de campo. COMERCIA no escribe
marcaciones ni pings por su cuenta: se los manda a UCHECK y los consulta con GET.
De las marcaciones COMERCIA guarda una **copia**, porque de ella cuelgan tareas,
fotos, presentismo y el resto de la operación.

Aplica a todos los roles de campo: impulsadores, TeamLeaders y repositores.

## Flujo de una marcación desde la web de COMERCIA

1. La persona toca **Iniciar Visita** o **Finalizar Visita** en *Mi jornada* o
   en *Gestión de campo → Itinerario*. Repositores, supervisores y TeamLeaders
   marcan directo, sin modal, y el resultado llega en un toast. Habilita
   cualquier programa de COMERCIA en UCHECK, no el nombre del rol.
   - **Primero, el teléfono.** UCHECK usa la última lectura GPS que la app
     mandó hasta 75 s antes del toque (lo que la app muestra como «Podés marcar
     en Comercia»); si no hay, espera hasta 20 s la próxima. En segundo plano
     Android atrasa esas lecturas, sobre todo con la batería optimizada.
   - **Si el teléfono no responde** (`codigo` TELEFONO_SIN_UBICACION), la web
     toma el GPS del navegador y marca con él, también a través de UCHECK.
   - **Sin conexión con UCHECK** (sin internet, o COMERCIA no llega a UCHECK:
     `codigo` UCHECK_SIN_CONEXION), ver *Marcas guardadas sin conexión*.
2. COMERCIA le manda la marca a UCHECK (`POST /comercia-integracion/marcar`).
3. UCHECK la valida en ese momento: asignación vigente en la agenda de
   COMERCIA, franja horaria, GPS dentro del radio del local, precisión de hasta
   150 m (y nunca peor que el radio del local), ubicación reciente (2 minutos
   como máximo) y tolerancias. Si algo no da, la rechaza y la persona
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

Mientras haya alguna, Mi Ruta / Itinerario muestra un aviso con **Reintentar**
(`GET /campo/jornada/operaciones-pendientes` y `POST .../reintentar`): UCHECK
vuelve a poner esas marcas en cola sin espera, también las FALLIDO
(`POST /comercia-integracion/marcaciones/reintentar`), y COMERCIA las trae en el
momento. La ruta se refresca sola cada 20 s mientras queden pendientes.

Titular y supervisor pueden visitar la misma asignación el mismo día: la visita
es única por persona + asignación + franja + día (migración
`20261105130000_visita_por_usuario`).

### Marcas guardadas sin conexión

Si no hay conexión con UCHECK, la web guarda la marca **en el navegador**
(`localStorage`, por cuenta) con su hora real y el GPS del navegador. La ruta
la muestra como visita en curso y deja finalizarla también sin conexión; un
aviso cuenta cuántas quedan y tiene **Enviar ahora**.

- Se mandan solas en orden (`SincronizadorMarcas`): al abrir el panel, al volver
  la señal o la pestaña, y cada minuto, con
  `POST /campo/jornada/marcas-sin-conexion`.
- COMERCIA las reenvía a UCHECK con `registradaEn` (la hora real). UCHECK las
  valida con esa hora, como las marcas offline de su app, las guarda y COMERCIA
  trae la copia: recién ahí aparecen en Presentismo.
- Reenviarlas no las duplica: UCHECK identifica cada marca por su operación.
- Un corte deja el resto para el próximo intento. Un rechazo (400/404/409/422:
  fuera de radio, horario, tareas del repositor sin terminar, hora inválida)
  sale de la cola y pasa a una lista de **rechazadas** en el mismo
  `localStorage` por cuenta (`comercia.marcas-rechazadas.<usuario>`), con el
  motivo y la fecha del rechazo. Además del toast, Ruta muestra un aviso fijo
  con local, tipo, hora y motivo de cada una, que queda hasta tocar
  **Entendido**.
- Si UCHECK responde 401/403 (credencial o vínculo entre servidores), 408/429
  o 5xx, COMERCIA devuelve 503 `UCHECK_SIN_CONEXION`: no es un "no" a la marca,
  la web la conserva y reintenta.
- Cada intento queda en el **registro de marcaciones** (ver abajo), y lo que
  no se aceptó, también como `warn` en el log de la API.
- Viven solo en ese navegador: si se borran sus datos (o se cierra una ventana
  privada) antes de enviarlas, se pierden.

### Registro de marcaciones

Cada pedido de marca de campo que llega a COMERCIA queda en la tabla
`campo_registro_marcaciones`, aceptado o no. Lo guarda el interceptor
`RegistroMarcacionInterceptor` en los endpoints `jornada/entrada`,
`jornada/repositor/entrada`, `jornada/visitas/:id/salida`,
`jornada/repositor/visitas/:id/salida` y `jornada/marcas-sin-conexion`.

- `resultado`: `ACEPTADA`, `RECHAZADA` (4xx, con su motivo, lo rechace COMERCIA
  —tareas sin terminar, hora inválida, datos inválidos— o UCHECK —fuera de
  radio, horario—) o `ERROR` (UCHECK caído o sin responder, 401/403 entre
  servidores, algo inesperado).
- Guarda quién marcó, copiado al momento (id, nombre y apellido, correo, login
  y empresa), la ruta, el estado HTTP, el código, el motivo y la duración.
  También guarda el pedido completo en `solicitud` (parámetros, consulta y
  cuerpo, con coordenadas) y la respuesta o el error en `respuesta`, ambos en
  `jsonb`. No guarda encabezados ni credenciales. No tiene claves foráneas, y si
  falla el guardado del registro, la marca sigue igual.
- Lo que no se aceptó también queda como `warn` en el log de la API.
- El superadmin lo ve en **Administración · Registro de marcaciones**
  (`GET /campo/superadmin/registro-marcaciones?resultado=&page=&limit=`): de la
  más reciente a la más antigua, filtrable por resultado, con el detalle del
  pedido y la respuesta.
- Lo que corta el guard (sin sesión) no llega al registro. No hay depuración
  automática: la tabla crece con cada pedido.
- UCHECK tiene su propio registro de lo que le llega (ver
  `UCHECK/docs/integracion-programas.md`).

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

- `components/campo/jornada-panel.tsx`: Mi Ruta e Itinerario, desde donde se
  marca. `marcarVisita` pide la ubicación del teléfono, usa la del navegador de
  respaldo o guarda la marca sin conexión, y avisa con un toast.
- `lib/marcas-sin-conexion.ts` y `components/campo/sincronizador-marcas.tsx`:
  las marcas guardadas en el navegador y su envío.
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
  puede marcar. El ABM de usuarios la mantiene solo (ver abajo).

## Usuarios: el ABM de COMERCIA manda en UCHECK

Crear, editar (datos, correo, nombre de usuario, programas, activo) o dar de
baja un usuario en COMERCIA se refleja en su cuenta de UCHECK
(`PUT /comercia-integracion/usuarios`). El nombre de usuario de COMERCIA es el
«Usuario único» de UCHECK.

- **Quién:** se crea en UCHECK quien tiene programas elegidos; el resto solo se
  actualiza o desactiva si ya estaba vinculado. No se tocan superadmins, cuentas
  `@sin-correo.invalid` ni las desvinculadas a mano.
- **Empresa:** la de UCHECK con el mismo nombre que en COMERCIA (sin distinguir
  mayúsculas ni acentos). Si no existe, el usuario queda pendiente.
- **Programas:** se eligen en el ABM («Programas asignados (Ucheck)») entre los
  que la empresa tiene habilitados en UCHECK (`GET /comercia-integracion/programas`,
  que COMERCIA expone en `GET /usuarios/programas-ucheck`). COMERCIA guarda la
  copia en `usuarios.programas_ucheck`: lo que UCHECK confirma después de cada
  envío. Solo se mandan si cambiaron en el ABM; si no, UCHECK conserva los
  suyos. En el alta sin elegir ninguno se usan los del rol de campo: equipo
  `REPOSITOR` → `COMERCIA_REPOSITOR`, supervisor o TeamLeader →
  `COMERCIA_TEAMLEADER`, el resto del equipo → `COMERCIA`, todos con `SEGUIMIENTO`.
- **Baja:** lógica (`isActive=false`); marcaciones e historial se conservan.
- **Si UCHECK no responde:** el cambio queda en `ucheck_usuarios_pendientes` y
  `UcheckUsuariosService` lo reintenta cada minuto con espera creciente (hasta
  1 h), sin perderlo. Siempre manda el estado actual completo: repetir no duplica.
- **Cambio de correo:** el vínculo se borra al instante (el SSO no lleva a la
  persona anterior) y vuelve cuando UCHECK cambió el correo de esa misma cuenta.
- Desplegar **primero UCHECK y después COMERCIA**. Al revés, COMERCIA llamaría
  endpoints que todavía no existen y las marcas desde la web fallarían. En ese
  orden no se pierde nada: lo marcado mientras tanto queda en UCHECK hasta que
  COMERCIA lo traiga.
- Las visitas abiertas antes de este cambio (sin pasar por UCHECK) se cierran
  como antes, en COMERCIA.
