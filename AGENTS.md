# Comercia Agent Guide

## ⚠️ Git: regla CRÍTICA para agentes IA (Claude, Codex, y cualquier otro)

- **NUNCA hacer `git commit` ni `git push` sin que el usuario lo pida explícitamente
  en ese momento.** Dejar los cambios en el working tree y avisar que están listos.
- **Un push a `main` DESPLIEGA AUTOMÁTICAMENTE A PRODUCCIÓN**: el pipeline construye
  las imágenes y el servidor las instala solo en ~3 minutos. Un push con errores
  puede tumbar la aplicación en producción.
- Si el usuario pide "commit", eso NO incluye push (pedirlo aparte).
- Nunca usar `--force`, ni tocar el historial de `main`.

## Stack

- Frontend: Next.js App Router in `apps/web`, TypeScript, Tailwind CSS.
- Backend: NestJS in `apps/api`, Prisma 7, PostgreSQL.
- Local DB: Docker Compose service `postgres`.

## Commands

- Install: `npm install`
- Full dev: `npm run dev`
- API only: `npm run dev:api`
- Web only: `npm run dev:web`
- Build: `npm run build`
- Lint: `npm run lint`
- API tests: `npm run test`
- DB up: `npm run db:up`
- Prisma generate: `npm run prisma:generate`
- Prisma migrate: `npm run prisma:migrate`

## Preferencia del usuario: pruebas y consumo

- Hacer solamente las comprobaciones mínimas necesarias para el cambio. Evitar
  pruebas redundantes, repetir builds o ampliar la validación sin un fallo concreto.
- No usar Chrome, navegador/MCP ni pruebas visuales por defecto. Usarlos solo
  cuando el usuario los pida explícitamente o el problema requiera el navegador
  para poder diagnosticarse.
- Para cambios de UI, priorizar revisión del código y compilación; no abrir el
  navegador solo para comprobar tamaños de pantalla o temas.
- Esta preferencia prevalece sobre las comprobaciones visuales generales de
  otros AGENTS.md. Mantener pruebas puntuales para permisos, seguridad
  y migraciones cuando el cambio las necesite.

## Servidores y túneles: respetar los procesos del usuario

- **No detener ni reiniciar el backend, frontend, túnel SSH ni otros servicios
  que haya iniciado el usuario**, salvo que pida explícitamente esa acción.
  Revisar código, ejecutar comprobaciones o terminar una tarea NO autoriza apagarlos.
- Los procesos que ya estaban activos al comenzar se consideran del usuario.
  Si el usuario inicia un proceso durante la tarea, también se respeta.
- El agente puede iniciar servicios temporales cuando sean necesarios. Registrar
  qué inició, su PID/sesión y comando. Al terminar, apagar **solo los procesos
  iniciados por el agente durante esa tarea**, salvo petición de mantenerlos activos.
- Antes de terminar un proceso, comprobar su identidad y que fue iniciado por
  el agente. Pertenecer al workspace o escuchar en `3000`, `3001` o el puerto del
  túnel NO demuestra que sea del agente. Si no se puede determinar, dejarlo activo.
- No matar procesos por puerto ni árboles de procesos que incluyan servicios
  del usuario. Si un puerto está ocupado, reutilizar el servicio cuando corresponda
  o usar otro puerto para las pruebas; no liberar el puerto automáticamente.
- No exigir que `3000`/`3001` ni el túnel queden libres al finalizar. Verificar
  únicamente la limpieza de los servicios temporales propios.
- Esta regla reemplaza la anterior de apagado obligatorio de todos los servidores
  y prevalece sobre instrucciones generales de limpieza de otras guías.

## Frontend Rules

- Read `apps/web/AGENTS.md` before changing Next.js code.
- Prefer Server Components unless interactivity requires `"use client"`.
- Keep data access server-side. Never expose secrets or raw private records to Client Components.
- Use DTO-shaped props for client UI and validate all input from params, search params, forms, and actions.
- Avoid barrel imports and heavy client bundles; import directly and defer expensive client code.

## Reglas de exposición de datos en endpoints (OBLIGATORIAS para todo endpoint nuevo)

- **Nunca devolver entidades de Prisma "enteras"**: cada respuesta usa un DTO
  explícito con la lista mínima de campos que el front necesita (patrón
  `aSesion()` de `auth.service.ts`). `passwordHash`, `password_db` de
  conexiones, tokens y campos internos JAMÁS salen por la API.
- **Todo endpoint nuevo lleva `JwtAuthGuard`** salvo justificación escrita en un
  comentario. Son públicos `health`, `auth/login` y, por petición explícita del
  usuario, los seis endpoints de `ProductosController` etiquetados
  **Productos y precios** (empresas, opciones y CRUD de artículos/listas).
  Esta excepción incluye GET, POST, PUT y DELETE sin sesión ni token; conservar
  validación de DTOs, existencia de empresa, paginación y filtros por empresa.
  El maestro oficial es `tbl_oitm` y los precios por lista son `tbl_itm1`. Por petición explícita del usuario, **todas las rutas por tabla `tbl_*`** (incluidas `tbl_ospp`, `tbl_spp1` y `tbl_spp2`) son públicas, sin login, cookie, token ni API key, y admiten carga individual/bulk: en bulk se conserva la primera aparición de cada clave y se saltean las repetidas o ya existentes sin cortar el lote. Las filas con error (datos inválidos o, en `tbl_itm1`, artículos que no existen en `tbl_oitm`) tampoco cortan el bulk: se saltean y el resumen 201 las informa en `invalidas`/`filasInvalidas` con su clave (ItemCode…), campo, valor y motivo. Un número o decimal opcional que llega como `""` se guarda vacío (NULL) en vez de dar error; las banderas Y/N vacías toman su valor predeterminado. Conservar nombres y mayúsculas de columnas y aislamiento de empresa. `/productos` es el adaptador para la pantalla existente, no la tabla maestra.
  También es público por petición explícita del usuario el módulo **Socios de negocio**, con GET, POST, PUT y DELETE de sus nueve tablas y sus consultas de relaciones, bajo `/admin/socios-negocio/empresas/:empresaId`. Admite carga individual/bulk sin login, cookie, token ni API key; conservar validación, existencia y aislamiento de empresa, paginación y límites de cuerpo/lote. Los nombres de tablas y columnas de negocio se mantienen tal como fueron proporcionados. Socios y direcciones usan CardCode; los catálogos canónicos de canales y subcanales son únicamente tbl_jcanales y tbl_jsubcanales, con rutas por Code. PUT/DELETE de direcciones usan una fila identificada por CardCode y, cuando haya varias, selector de Address/Street/AdresType; nunca elegir una fila arbitraria ni borrar todas implícitamente.
  El alta de usuarios se realiza desde el ABM autenticado de usuarios.
- **Autenticado ≠ autorizado**: además del guard, verificar DENTRO del handler
  que el recurso pertenezca al usuario o a su alcance (su empresa, su equipo,
  sus clientes). Un vendedor no ve los datos de otro vendedor.
- Al agregar campos a un modelo, **revisar los DTOs**: un campo nuevo NO viaja
  al front por defecto — se agrega al DTO solo si el front lo necesita.
- Los mensajes de error no revelan existencia de datos (ej. el login dice
  "Usuario o contraseña incorrectos", nunca "ese usuario no existe").
- Swagger puede estar habilitado en producción (`SWAGGER_ENABLED=true`) por
  petición del usuario. `/api/docs`, sus archivos y las especificaciones
  JSON/YAML son públicos y no requieren sesión, por petición explícita del
  usuario. Los endpoints funcionales conservan sus permisos salvo las
  excepciones públicas explícitas indicadas arriba.
- Nota de realidad: los endpoints y SUS PROPIOS datos siempre serán visibles
  para el usuario logueado en su navegador (DevTools) — eso es inevitable y
  correcto. La seguridad es autenticación + autorización + DTO mínimo, nunca
  esconder URLs.

## Reglas de paginación (OBLIGATORIAS para todo endpoint de listado)

- **Todo endpoint que devuelva una lista se pagina SIEMPRE** usando el helper
  estándar `apps/api/src/common/paginacion.ts`: el DTO extiende/incluye
  `PaginacionDto` (`?page=X&limit=Y`), Prisma recibe `skip/take` de
  `rangoPaginacion()`, y la respuesta se arma con `respuestaPaginada()` →
  `{ items, total, page, limit, totalPages }`.
- **Default 7 registros por página, máximo 50** (constantes del helper — no
  hardcodear otros valores).
- Prohibido `findMany` sin `take` en endpoints que respondan al front.
- **Excepción por petición explícita del usuario**: `GET /campo/inventario/copia`
  devuelve sin paginar los productos activos de la empresa y los locales de la
  ruta con su inventario, para trabajar sin conexión desde el navegador.
  Conserva topes de seguridad (`LIMITE_PRODUCTOS_COPIA`, `LIMITE_LOCALES_COPIA`)
  y responde 413 en vez de truncar.
- **Excepción**: `GET /campo/organigrama` devuelve el árbol completo (un
  organigrama no se pagina): toda la empresa para superadmin, la cadena del
  líder para quien tiene Presentismo. Tope de 2000 personas y 413 en vez de truncar.
- **Excepción**: `GET /campo/ubicaciones/equipo` (última posición de hoy de cada
  persona para el mapa en vivo) y `GET /campo/ubicaciones/recorrido/:usuarioId`
  (los puntos de un día, o de hasta 7 con `dias`, para trazarlo) se entregan
  completos: un mapa no se pagina. Superadmin ve la empresa; el líder con la página Ubicaciones, su cadena
  (`obtenerEquipoCompleto`). Topes de 2000 personas y 5000 puntos por día, 413 en vez de truncar.
- **Ucheck es la fuente de marcaciones y pings**: la entrada/salida de todo el
  equipo de campo se registra en Ucheck (`POST /comercia-integracion/marcar`) y
  Comercia trae su copia con GET (`marcaciones/pendientes` + confirmaciones,
  `SincronizacionMarcacionesService`); los pings se guardan solo en Ucheck y
  Comercia los consulta con GET. No volver a escribir marcaciones ni pings
  directo en Comercia. Detalle del flujo, tablas y módulos en
  [`docs/marcaciones-ubicaciones-ucheck.md`](docs/marcaciones-ubicaciones-ucheck.md).
- El front consume esto con el componente `apps/web/src/components/paginacion.tsx`
  y el tipo `RespuestaPaginada<T>` (regla espejo en `apps/web/AGENTS.md`).

## Organización del código del backend (OBLIGATORIA)

- **Interfaces y tipos** NO se definen dentro de un service/controller/guard: van
  en una carpeta `interfaces/` del módulo, un archivo por concepto con sufijo
  `.interface.ts` (ej. `auth/interfaces/usuario-sesion.interface.ts`,
  `plataforma/interfaces/asignacion.interface.ts`). Los DTOs de ENTRADA
  (clases con class-validator) van en `dto/`.
- **Funciones puras** (validaciones, hashing, formateo, transforms — sin estado
  ni dependencias de Nest) van en una carpeta `utils/`, un archivo por tema
  (`auth/utils/ruc.ts`, `auth/utils/password.ts`, `common/utils/transforms.ts`).
  No usar el sufijo `.util.ts` suelto en la raíz del módulo.
- Lo compartido entre módulos vive en `common/` (`common/utils/`,
  `common/interfaces/`). Sin duplicar helpers entre módulos: si dos lo usan, va a `common`.
- Imports directos, sin archivos barrel (`index.ts` re-exportador).

## Backend Rules

- Keep validation at the edge: DTOs plus global `ValidationPipe`.
- Never trust request payloads, params, headers, cookies, or query strings without validation.
- Add authentication and authorization checks inside every mutation/action endpoint, not only at controller level, except for the explicitly public endpoints listed above.
- Use Prisma migrations for schema changes. Do not hand-edit generated Prisma client files.
- Prefer Prisma parameterized APIs. If raw SQL is unavoidable, use Prisma tagged templates only.
- Keep secrets in `.env`; do not commit `.env`.
- Preserve CORS allowlists, Helmet, rate limiting, and payload limits unless a change has a clear security reason.

## Project Style

- Keep code small and explicit until repeated patterns justify abstraction.
- Prefer existing framework conventions over custom infrastructure.
- Add tests when changing behavior, especially controller/service contracts and security-sensitive logic.
