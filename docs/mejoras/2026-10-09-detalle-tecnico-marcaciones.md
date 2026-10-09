# Detalle técnico de marcaciones — Uweb y Comercia

## Brief

Propósito: comparar las señales capturadas al entrar y salir, desde Presentismo.
Audiencia: administradores y líderes, en celular y escritorio. Tono: consola
operativa. Diferenciador: comparación Entrada/Salida por campo, con ayuda táctil
«i», sin ensanchar el listado. Uweb conserva Cobalt, Geist/Space Grotesk/JetBrains
Mono y sus tokens; Comercia conserva verde/cobre, IBM Plex/Barlow y tokens que
resuelven claro/oscuro. Filas compactas, objetivos de 44px, scroll dentro del modal,
texto que puede envolver y consultas cancelables al abrir el detalle. No informado
es distinto de No, cero y salida pendiente. No se inventan señales históricas.

## Archivos y alcance

API Uweb: controlador/servicio de Presentismo, consulta de detalle, tipos y selector
técnico explícitos. Web Uweb: Presentismo y matriz, nuevo detalle técnico, ayudas,
tipos, formato y estilos. API Comercia: servicio de supervisión y controlador de
Campo, listado de marcaciones paginado dentro del mismo alcance de colaborador.
Web Comercia: ficha de supervisión, pestaña Marcaciones, modal técnico y ayudas.
Se agregan pruebas de autorización, selección de campos y presentación. No se
eliminan rutas ni componentes. Sin cambio de esquema, captura móvil ni migración.

## Verificación

30 pruebas puntuales aprobadas: 18 web, 7 API Uweb y 5 API Comercia. Cubren carga
bajo demanda, retorno del foco, ayudas táctiles, errores/reintento, formato
equivalente, matriz/diario, alcance de empresa/equipo, paginación y saneado de
JSON. Compilaciones y lint puntual de las cuatro aplicaciones aprobados. Grafo
AST de Comercia actualizado sin llamada a modelos. Sin navegador según preferencia
del usuario; revisión visual pendiente.

## Uso y significado

Uweb: Datos técnicos en cada fila/tarjeta del reporte diario. Semana/Mes: elegir
una celda y Datos técnicos en la marcación de su inspector/modal. La matriz
expande los datos en el detalle actual para evitar diálogos anidados. Comercia:
Presentismo → Ver ficha → Marcaciones → Ver datos. Se consultan las visitas del
período en páginas de 7 (máximo 50), sin tomar solamente la primera visita de cada
local. Pestañas breves para caber en celular. Los listados principales conservan
su tamaño: las señales solo se consultan al abrir el detalle/pestaña.

35 campos explicados con «i»: hora aceptada/capturada/recibida, coordenadas,
precisión, distancia, centro/radio, turno/atención, ubicación activa/simulada,
batería/carga/ahorro, red/Internet/avión, sincronización, reloj y dispositivo/app.
Entrada y Salida se comparan campo por campo. «No» conserva falsos y «0» conserva
ceros; «No informado» indica ausencia de captura; «Pendiente» indica ausencia de
salida. Las señales corresponden a ese momento, no al estado actual del celular.
La precisión atípica y la ubicación simulada son señales, no decisiones de fraude.

Uweb recupera ContextoMarcacion con selección explícita (hasta dos por jornada),
sin exponer IDs internos/correos. La hora declarada del teléfono no está persistida
en su modelo de contexto: se muestra No informado. Comercia consulta los eventos
Ucheck relacionados con empresa/persona y filtra su JSON por una lista explícita
de claves/tipos; visitas antiguas/directas conservan coordenadas existentes sin
inventar contexto. No se agregaron datos a exportaciones o listados públicos.

## Publicación del 2026-10-09

API y web de ambos sistemas publicadas manualmente, sin commit ni push. Uweb:
http://172.19.0.140:3002/uweb/presentismo. Comercia:
http://172.19.0.140:1002/panel/gestion-campo/visitas. Los permisos existentes de
empresa/equipo se conservan. Ambas consultas autenticadas respondieron 200 con
marcaciones reales; sin token, 401. El detalle usa Cache-Control: private, no-store.
La verificación solo leyó datos: no creó usuarios, sesiones ni marcaciones.

Los cuatro servicios quedaron saludables. Se comprobaron 285 archivos de runtime
(API Uweb: 15, API Comercia: 15, web Comercia: 255), 42 archivos estáticos HTTP y
4 rutas de Comercia; Uweb: 26 archivos públicos exactos, 8 rutas y 132 archivos
fuente de API/esquema. PostgreSQL de ambos sistemas conservó sus contenedores.
El APK existente 1.2.15 sigue disponible; esta mejora no cambia la captura móvil.

| Servicio | Imagen instalada |
| --- | --- |
| ucheck-api | `sha256:a42392b52a7e4b8165364c700d202584ea0ed43463214f21b42fd6bc65120956` |
| ucheck-web | `sha256:b43ccd82e63ef2e0ac62064a2413d46f533a507ab12ea2335fcc0580e978288f` |
| comercia-api | `sha256:b542ca416960a6cb3e4569861cb80a4c907346eeebfda875c34ed209661b4915` |
| comercia-web | `sha256:32a8c1c63d2a04e0d8f885777cef2fff0ceb0d240b2c88af7791fda94e1564a4` |

Uweb API: `edf1b566b4ce69645a4e1550ff6df1c0e310cca2+marcaciones.8b5a4cd761c3`.
Uweb web: `edf1b566b4ce69645a4e1550ff6df1c0e310cca2+worktree.932c90e7f4b2`.
Comercia API: `1a1f09894ee88bb63c496a9db752da84ca93c3b8+marcaciones.be97edb12f8b`.
Comercia web: `1a1f09894ee88bb63c496a9db752da84ca93c3b8+marcaciones.ba08e3e197f3`.
Los sufijos identifican el contenido local publicado, no commits nuevos.

### Fijación autorizada de Comercia

El cron anterior descargaba latest cada tres minutos y sustituyó las imágenes
manuales de API y web por las anteriores. Con autorización expresa del usuario,
se fijaron API_TAG y WEB_TAG en `marcaciones-20261009T120634Z` y se agregó una
comprobación a `deploy/auto-deploy.sh`: solo descarga latest cuando ambas
imágenes configuradas usan latest. Sintaxis Bash y ejecución como usuario deploy
comprobadas; la tarea conservó las versiones fijadas y salió correctamente.
Solo se recrearon API/web. La fijación quedó activa a las 2026-10-09T12:29:22Z.

Mientras están fijadas esas etiquetas, la tarea no instala automáticamente nuevas
imágenes desde GHCR. Para reanudar ese flujo, primero publicar una versión que
incluya esta mejora y después restaurar API_TAG/WEB_TAG a latest. No quitar la
fijación mientras latest contenga la versión anterior.

Artefactos, manifiestos, fuentes, comprobaciones y respaldos de imágenes/fuentes:
`/opt/ucheck/deployments/marcaciones-20261009T120634Z/`; Uweb web se encuentra en
su subdirectorio `uweb-20261009T120928Z`. Comercia web conserva una instantánea
completa de sus 146 archivos fuente en ese directorio, sin reemplazar el árbol
web histórico de `/opt/comercia/builds`. Uweb sincroniza sus fuentes web y ambas
APIs sus cinco archivos de implementación publicados.

La carpeta restringida `manual-pin` guarda el script y la configuración anteriores
para recuperación; no copiar ni publicar su respaldo de .env. La comprobación
final sin credenciales se guarda en `final-verification.json`. Las etiquetas
`before-marcaciones-20261009T120634Z` (APIs y Comercia web) y
`before-uweb-20261009T120928Z` (Uweb web) conservan las imágenes anteriores.
