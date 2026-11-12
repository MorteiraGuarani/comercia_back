<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Comercia frontend rules

## Selectores con muchas opciones

- Si un campo puede tener cientos o miles de opciones (clientes, locales,
  usuarios, productos), usar un selector con búsqueda remota y paginación.
  No descargar el catálogo completo ni obligar a recorrer opciones a ojo:
  aumenta el consumo, vuelve lento el formulario y facilita selecciones erróneas.
  Excepción pedida por el usuario: Mi jornada · Inventario guarda en IndexedDB
  (Dexie) los productos y los locales de la ruta para trabajar sin conexión; sus
  listas y su selector buscan y paginan sobre esa copia con las mismas reglas.
- Reutilizar `src/components/selector-paginado.tsx` con `buscable` cuando el
  endpoint admita `buscar`. El servidor filtra dentro del alcance autorizado
  y pagina; filtrar solamente la página actual en el navegador no alcanza.
- La búsqueda y la selección deben compartir **un solo campo editable
  (combobox)** con la etiqueta del dato, por ejemplo «Cliente». No agregar
  un input «Buscar cliente» separado de otro select «Cliente».
- Al enfocar o hacer clic, abrir el desplegable con la primera página sin
  exigir texto previo: 5 opciones, sin paginador; al escribir, las 5 más parecidas.
  Escribir filtra la búsqueda remota; elegir una opción muestra su nombre
  en ese mismo campo y cierra el desplegable.
- Permitir flechas, Enter para elegir y Escape para cerrar, además de clic
  y toque. El texto libre no es una selección válida: guardar exige un ID
  elegido cuando el campo es obligatorio.
- Esperar brevemente al escribir, cancelar consultas anteriores y descartar
  respuestas obsoletas. Volver a la primera página al cambiar la búsqueda.
- Mantener el ID y nombre seleccionados aunque no estén en los resultados
  actuales. Mostrar carga, errores con reintento y búsqueda sin resultados.
  La búsqueda no debe bloquear la escritura ni enviar el formulario con Enter.
- Reservar selects sin buscador para conjuntos pequeños y acotados, como
  estados o días de la semana. No activar búsqueda en endpoints que no la soporten.

- Prefer Server Components and direct imports.
- Keep client components small and avoid passing private server data into them.
- Put environment variables exposed to the browser behind `NEXT_PUBLIC_` only when they are truly public.

# Organización del código del front (OBLIGATORIA)

- **Tipos e interfaces de dominio** (Usuario, Empresa, Pedido, respuestas de la
  API...) van en `src/types/` — un archivo por dominio (`types/usuario.ts`,
  `types/empresa.ts`), NUNCA definidos dentro de un componente o página.
  Excepción: la interfaz de Props de un componente puede vivir junto a él.
- **Funciones puras** (formateo, validaciones, normalizaciones — sin React ni
  fetch) van en `src/utils/` — un archivo por tema (`utils/ruc.ts`,
  `utils/formato.ts`, `utils/texto.ts`, `utils/paises.ts`).
- `src/lib/` es para clientes de servicios (ej. `lib/api.ts`); `src/components/`
  solo componentes visuales.
- **Imports directos siempre** (`@/types/usuario`, `@/utils/ruc`) — sin archivos
  barrel (`index.ts` re-exportador).

# Tablas y paginación (OBLIGATORIO en toda tabla/listado)

- Cuando una pantalla muestre varios registros o pueda crecer a muchos
  registros, usar una **tabla** como representación principal, nunca una grilla
  de cards. Las cards quedan reservadas para KPIs, resúmenes, estados destacados
  o conjuntos pequeños que no representan filas homogéneas.
- **Toda tabla se pagina, siempre** — en el back Y en el front. Nada de traer
  listas completas.
- **7 registros por página por defecto**, con selector para ver más (7 / 15 / 30).
- Front: usar el componente estándar [`src/components/paginacion.tsx`]
  (mantener `page` y `limit` en el estado de la página; pedir a la API con
  `?page=X&limit=Y`; tipar la respuesta con `RespuestaPaginada<T>` de
  `@/types/paginacion`).
- Back: ver la regla espejo en el AGENTS.md de la raíz (helper
  `apps/api/src/common/paginacion.ts`).

# Caché y consumo de datos (OBLIGATORIO)

El rendimiento y el ahorro de datos del usuario (celular, datos móviles) son
prioridad. No volver a descargar lo que la pantalla ya tiene.

- **Listados paginados: usar siempre `useListaCampo`** (`src/hooks/use-lista-campo.ts`).
  No escribir un `useEffect` + `apiFetch` propio para una lista paginada.
- El hook guarda las páginas ya vistas mientras la pantalla siga montada:
  volver de la página 2 a la 1 no llama a la API. Salir de la pantalla y
  volver a entrar sí consulta de nuevo.
- La caché se descarta sola al cambiar la URL (filtros), `revision` o al llamar
  `refrescar()`. Después de crear, editar o eliminar, llamar `refrescar()` (o
  subir `revision`) para no mostrar datos viejos.
- Un botón **Buscar** que aplica filtros debe llamar `refrescar()`: buscar de
  nuevo trae datos frescos.
- Para consultas de conteo u opciones (ej. `limit=1` para saber si mostrar un
  filtro) también usar el hook, así comparten el mismo comportamiento.
- **Icono, apple-icon y manifest van fijos en el `<head>` del layout raíz**
  (`src/app/layout.tsx`), servidos desde `public/` o `src/app/pwa/`. No usar
  las convenciones `app/favicon.ico`, `app/manifest.ts` ni `app/apple-icon.tsx`:
  Next los reinserta en cada navegación y el navegador los vuelve a descargar.
- `experimental.staleTimes.dynamic` (`next.config.ts`) mantiene 5 minutos en
  memoria las pantallas ya abiertas. Los datos no dependen de eso: cada pantalla
  los pide a la API al montarse.
- Nada de sondeos frecuentes que descarguen HTML o listas completas: la
  comprobación de versión (`ActualizadorDespliegue`) descarga como mucho una
  vez cada 15 minutos. Cualquier sondeo nuevo necesita un intervalo justificado
  y no debe dispararse en cada foco o cambio de pestaña sin un tope.

# Reglas de UI/UX de Comercia (OBLIGATORIAS — aplicarlas en TODO lo que se construya)

## Vista móvil de tablas (OBLIGATORIA)

- **Nunca forzar una tabla ancha en celular.** Toda tabla de más de tres
  columnas, existente o nueva, debe tener una representación operativa para
  pantallas menores a `md`: lista vertical (`md:hidden`) y tabla desde `md`
  (`hidden md:block`). No usar scroll horizontal como experiencia principal en
  teléfono.
- La lista y la tabla consumen los **mismos `items` paginados, estado, filtros y
  callbacks**: no duplicar peticiones ni crear una fuente de datos paralela.
- Cada fila móvil muestra primero la identidad (nombre + contexto), luego entre
  dos y cuatro datos prioritarios (estado, fecha/agenda, cantidades o progreso)
  y por último la acción principal. Los detalles secundarios van en un
  desplegable explícito, no en una tarjeta alta por defecto.
- Mantener los objetivos tÃ¡ctiles en `min-h-11`, textos de botones en una sola
  lÃ­nea (`whitespace-nowrap`), `w-full min-w-0` en el contenedor y colores con
  soporte claro/oscuro. La vista mÃ³vil no puede causar scroll horizontal de la
  pÃ¡gina.
- Usar `aria-label` para las listas, `aria-expanded` / `aria-controls` en los
  detalles expandibles y conservar las etiquetas accesibles de acciones. Para
  listas largas, se puede aplicar `content-visibility: auto` a cada ítem.

## Elementos clickeables

- Para la acción **Editar** en listados, usar `src/components/boton-editar.tsx`.
  Consultar [`docs/patron-acciones-edicion.md`](../../docs/patron-acciones-edicion.md)
  al crear o modificar pantallas: icono en tablas, texto en tarjetas móviles y
  etiqueta accesible con el nombre del registro. Editar va antes de las demás
  acciones de la fila.

- **Todo** elemento clickeable (botón, link, opción de lista, fila accionable,
  ícono, tarjeta que navega) debe tener **cursor pointer** y un **hover visible**
  (cambio de fondo, borde o subrayado). Hay una regla base en `globals.css` que
  cubre `button` y `[role="button"]`; para divs/spans/filas clickeables agregar
  `cursor-pointer` explícito.
- Además del hover, incluir `focus-visible` (anillo de foco) para uso con teclado.
- **Finalizar, terminar, completar o cerrar algo** (Finalizar Visita, Finalizar
  tarea, Cerrar novedad, Completar…) usa siempre el rojo claro: `btnFinalizar`
  de `src/components/ui.ts`, o `colorFinalizar` sobre un botón de otro tamaño.
  No usar verde ni el color de marca para estas acciones.
- Deshabilitados: `disabled:opacity-50 disabled:cursor-not-allowed`.

## Feedback global de procedimientos

- Toda operación que espere geolocalización, red, archivos, cálculo o una
  navegación externa debe mostrar `src/components/pantalla-carga.tsx` cubriendo
  la pantalla mientras se procesa. El mensaje debe describir la acción concreta
  (por ejemplo, “Calculando mejor ruta” o “Subiendo foto”), bloquear clics
  duplicados y limpiarse también cuando la operación falla (`finally`).
- Las acciones instantáneas puramente locales no llevan backdrop. Mantener los
  indicadores inline cuando aporten contexto, pero no usarlos como único
  feedback durante un procedimiento bloqueante.

## Carga de datos: skeleton (OBLIGATORIO)

- Mientras se cargan datos que se van a mostrar (una consulta a la API, un
  procedimiento de SAP, una búsqueda de clientes o productos, el detalle de un
  registro), mostrar un **skeleton** con la forma de lo que va a llegar, no un
  texto “Cargando…”. Usar `src/components/skeleton.tsx`: `SkeletonFilas` para
  listas y detalles, y `Skeleton` para piezas sueltas (un KPI, un título).
- `SkeletonFilas` lleva `etiqueta` con lo que se carga (“Cargando clientes”):
  queda para lectores de pantalla con `role="status"`. Dar el mismo marco
  (borde, fondo, padding) que el contenido real para que no salte al llegar.
- Las animaciones del skeleton respetan reducir movimiento (`motion-safe:`) y
  usan los colores del tema, con soporte claro y oscuro.
- El skeleton es para **leer**. Las operaciones que el usuario dispara y debe
  esperar (guardar, enviar, marcar, subir) siguen con `PantallaCarga`.

## Botones de alta en ABM

- Todo botón que abra el alta de una entidad debe mostrar exclusivamente el
  ícono `+` usando `src/components/icono-mas.tsx`, sin texto ni nombre de la
  entidad al lado. Debe ser un objetivo táctil cuadrado de al menos 44 px e
  incluir `aria-label="Crear <entidad>"` y `title="Crear <entidad>"`.
- Excepción: si hay dos o más botones de alta contiguos y el ícono solo resulta
  ambiguo, cada botón debe mostrar `+` y el nombre corto de su entidad. Ejemplo
  en Mapa: `+ Territorio` y `+ Zona`.
- Esta regla aplica a todos los ABM existentes y nuevos. Los títulos de los
  modales y los botones que confirman el formulario pueden usar `Crear ...`.

## Modales

- Los modales centrados se cierran con **X**, **Escape** o **Cancelar**; el fondo
  no los cierra.
- Por pedido del usuario, las **hojas que suben desde abajo en móvil** también
  se minimizan al tocar el fondo o arrastrar su tirador/encabezado hacia abajo.
  Mientras se arrastran pueden volver a subirse; el cierre se decide al soltar.
  Usar `useHojaDeslizable` y el mismo callback de cierre para conservar las
  confirmaciones de cambios pendientes. El contenido conserva su scroll normal.
- Al abrir, el foco pasa al **primer campo** del modal (lo hace `Modal`): en el
  celular se escribe sin tocar antes. Un selector con búsqueda (`role="combobox"`)
  no se enfoca solo para no abrir su lista. Si el campo aparece después de
  cargar datos, usar `autoFocus` en ese campo. Al cerrar, el foco vuelve al
  elemento que lo abrió.
- Todo modal tiene una salida visible abajo: "Cancelar" en formularios, o
  `textoCerrar="Cerrar"` / `"Listo"` de `Modal` cuando no hay formulario.
- **Al terminar bien** (guardar, enviar, finalizar) el modal se cierra solo y el
  resultado se avisa con `mostrarToast`: verde (`exito`) si salió bien, amarillo
  (`alerta`) si quedó pendiente o falta algo del usuario, rojo (`error`) si falló.
  Si falla, el modal queda abierto con el motivo. Enviar un comentario de
  tarea también cierra su modal (`onEnviado` de `PanelComentarios`). Excepción:
  las respuestas en el hilo de una novedad siguen abiertas al enviar.
- Un modal con varios pendientes (las tareas del local) queda abierto mientras
  falten y se cierra al finalizar el último.
- Las acciones de un toque que no necesitan datos (Iniciar/Finalizar visita)
  no abren modal: se ejecutan directo con `PantallaCarga` y avisan con toast.
  Los toasts se cierran solos a los 7 segundos.
- Si el modal tiene un formulario con cambios sin guardar, "Cancelar"/X/Esc
  pueden pedir confirmación antes de descartar.

## Responsive (crítico: los comerciales usan la app desde el CELULAR)

- **Mobile-first**: diseñar primero para ~360px de ancho y expandir con
  `sm:`/`md:`/`lg:`. Los pares de campos van `grid-cols-1 sm:grid-cols-2`.
- En layouts `flex`/`grid`, el contenedor principal debe usar `min-w-0 w-full`
  para que tablas, mapas o contenido ancho no agranden el viewport. Los navbars
  móviles ocupan siempre `w-full` y respetan los `safe-area-inset` del equipo.
- **Prohibido el scroll horizontal** de página; contenido ancho (tablas, listas
  largas) va dentro de su propio `overflow-x-auto`.
- Objetivos táctiles cómodos: mínimo ~44px de alto en móvil para botones y filas.
- Probar cada pantalla nueva al menos en 360px (celular) y 1280px (escritorio).

## Modo claro/oscuro (OBLIGATORIO en todo código nuevo)

- El tema funciona por **clase** (`.dark` en `<html>`): automático según el
  dispositivo por defecto, con botón manual en el navbar (`BotonTema` en
  `src/components/boton-tema.tsx`) que persiste en `localStorage("tema")`.
  El script inline de `layout.tsx` aplica la clase antes del primer pintado.
- **Cada página, módulo, modal o componente nuevo DEBE implementar su modo
  oscuro EN EL MISMO MOMENTO en que se escribe** — no "después": toda clase de
  color (`bg-*`, `text-*`, `border-*`, `ring-*`, sombras con color) lleva su
  variante `dark:` correspondiente. Un PR/cambio con colores sin variante
  `dark:` está incompleto.
- Probar visualmente ambos modos antes de dar por terminada una pantalla
  (el botón del navbar hace el cambio al instante).
