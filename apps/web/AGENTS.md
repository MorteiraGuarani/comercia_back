<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Comercia frontend rules

## Selectores con muchas opciones

- Si un campo puede tener cientos o miles de opciones (clientes, locales,
  usuarios, productos), usar un selector con búsqueda remota y paginación.
  No descargar el catálogo completo ni obligar a recorrer opciones a ojo:
  aumenta el consumo, vuelve lento el formulario y facilita selecciones erróneas.
- Reutilizar `src/components/selector-paginado.tsx` con `buscable` cuando el
  endpoint admita `buscar`. El servidor filtra dentro del alcance autorizado
  y pagina; filtrar solamente la página actual en el navegador no alcanza.
- La búsqueda y la selección deben compartir **un solo campo editable
  (combobox)** con la etiqueta del dato, por ejemplo «Cliente». No agregar
  un input «Buscar cliente» separado de otro select «Cliente».
- Al enfocar o hacer clic, abrir el desplegable con la primera página sin
  exigir texto previo: 7 opciones por defecto (al menos 5 si existen).
  Escribir filtra la búsqueda remota; elegir una opción muestra su nombre
  en ese mismo campo y cierra el desplegable. Paginar dentro del desplegable.
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

- Use `.agents/skills/vercel-react-best-practices` when writing or reviewing React/Next.js code.
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

- **Todo** elemento clickeable (botón, link, opción de lista, fila accionable,
  ícono, tarjeta que navega) debe tener **cursor pointer** y un **hover visible**
  (cambio de fondo, borde o subrayado). Hay una regla base en `globals.css` que
  cubre `button` y `[role="button"]`; para divs/spans/filas clickeables agregar
  `cursor-pointer` explícito.
- Además del hover, incluir `focus-visible` (anillo de foco) para uso con teclado.
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

- Un modal se cierra **SOLO de tres maneras**: el botón **X** (arriba a la
  derecha), la tecla **Escape**, y el botón **Cancelar**.
- **NUNCA se cierra al hacer clic en el fondo/backdrop** — un clic accidental no
  puede tirar a la basura un formulario a medio llenar.
- Al abrir, el foco pasa al modal; al cerrar, vuelve al elemento que lo abrió.
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
