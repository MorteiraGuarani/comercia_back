# Ancho de escritorio, acciones y Estado en el APK

## Brief y alcance antes de editar

Consola operativa para administrar y leer presentismo con menos espacio perdido.
Uweb conserva Cobalt y sus fuentes; Comercia conserva verde/cobre y sus tokens;
Android conserva Manrope y azul UCHECK. El ancho máximo web crece aproximadamente
30%, con márgenes de escritorio más pequeños en Uweb. Mobile conserva su ancho
seguro. Roles/Departamentos muestran dos acciones de 44 px con iconos, nombre
accesible y tooltip, en una columna ajustada. Historial Android incorpora Estado
y coloca su leyenda debajo: estados derivados de las marcaciones y horario real,
sin inventar ausencias. Conserva fila accionable, detalle, filtros y paginación.

Archivos previstos: Uweb tokens.css, styles.css, ui.tsx, Roles.tsx,
Departamentos.tsx, design.md; Comercia globals.css y panel/layout.tsx; mobile
estado-marcacion.ts, historial-locales.tsx, prueba existente y app.json.
Documentación en ambos repositorios. Sin eliminaciones ni migraciones. Compilar,
probar lógica de estados/horarios y firma del APK; revisión visual pendiente,
sin navegador. El usuario autorizó commit, push y producción de esta entrega,
incluyendo los detalles técnicos ya terminados en ambos árboles de trabajo.

## Cambios y verificación local

Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4. Se preservan identidad,
jerarquía, tablas paginadas, foco, estados deshabilitados y alcance. Contenido
Uweb máximo 106.6rem; Comercia 104rem en los contenedores amplios del panel.
El límite se adapta al espacio disponible: no se fuerza un 130% del viewport.
Las acciones de los dos catálogos tienen nombre del registro para lectores de
pantalla; se conservan bloqueos de roles protegidos y departamentos con usuarios.

Android comparte la tabla entre historial Uweb y Comercia. Conserva las
marcaciones, detalle y filtros; añade solo la columna Estado y mueve la leyenda
bajo la tabla. Sus horas se apilan para caber con cuatro columnas desde 320px.
Completa describe entrada/salida; no implica puntualidad sin evaluación.
Llegada tarde exige entrada marcada fuera de franja y posterior al inicio.
Otras incidencias muestran Fuera de horario. En curso/Sin salida usan la fecha,
fin de franja y zona horaria; turnos nocturnos terminan al día siguiente y visitas
sin franja usan fin del día. Cancelada/Pendiente conservan su significado.
Las definiciones de estados presentes en esa página se muestran debajo de la
leyenda, evitando repetirlas en cada fila.

Compilación/lint de Uweb aprobados; tipado y prueba puntual de historial Android
aprobados, incluyendo cierre del detalle, leyenda debajo, llegada tarde, entrada
anticipada, franja vencida, turno nocturno y cambio de día en America/Asuncion.
Versión APK 1.2.16, versionCode 27. Compilación firmada terminada y comprobada con apksigner/aapt. Verificación
visual y prueba en Android físico pendientes, sin navegador ni dispositivo.

## APK comprobado

Paquete app.ucheck.mobile, versión 1.2.16, versionCode 27; 90.213.457 bytes.
Certificado habitual SHA-256:
`d6e88d2c2548dc1c271ee07dac26f2ae9030085186a429e948b59766cadf112b`.
SHA-256 del APK:
`7b0c569f1bc92e94b9e37bc44c161683867e03d96586396761c5d1ceb585aee3`.
El bundle firmado contiene las etiquetas de Estado y su leyenda. El APK y la
firma no se versionan; solo fuentes y documentación. Copia local:
`C:/Users/carlos.morteira/Documents/UCHECK APK/v1.2.16-20261009-0949/UCHECK-v1.2.16.apk`.
Destino de descarga: /descargas/UCHECK-v1.2.16.apk y su archivo .sha256.
También pasaron dos pruebas de Departamentos y cuatro de los datos técnicos.

## Producción y commits

Publicación final comprobada el 2026-10-09T13:00:20.368523+00:00.
Commit funcional Ucheck: `9bc59b836ddf72948ad31e85f0ff969bcf973726`.
Commit funcional Comercia: `dd2bbbc31acff31045f972f2c3531782e43688ce`.
Ambos están en origin/main. Incluyen los datos técnicos de entrada/salida de la
entrega anterior, previamente publicados sin commit. Las fuentes de implementación
coinciden con las versiones publicadas; la API Uweb conserva sus 15 archivos de
runtime de esa mejora, comprobados por hash, pues esta entrega no cambió su lógica.

Uweb: 26 archivos públicos exactos, 8 rutas, API/base saludables y 401 sin token.
Comercia: [workflow completo aprobado](https://github.com/MorteiraGuarani/comercia_back/actions/runs/37932713350),
imágenes oficiales del commit verificadas contra sus IDs, detalle autenticado
con datos reales HTTP 200 y no-store, 401 sin token, CSS público con el ancho
nuevo y HTML con el identificador del commit. Cuatro servicios saludables y
PostgreSQL de ambos sistemas con sus contenedores originales.

Se retiró la fijación manual anterior de Comercia: API_TAG/WEB_TAG volvieron a
latest después de comprobar que latest y las etiquetas del commit apuntaban a
las mismas imágenes. El cron se ejecutó como deploy y conservó esta publicación;
las actualizaciones automáticas están reanudadas. El guard de versiones fijadas
permanece para que futuras publicaciones manuales no se sustituyan por latest.

| Servicio | Imagen activa |
| --- | --- |
| ucheck-api | `sha256:a42392b52a7e4b8165364c700d202584ea0ed43463214f21b42fd6bc65120956` |
| ucheck-web | `sha256:7576f60c90ce581cabebc8ef6ba6c39734f9d67fabd7cec10423c77c7908e2a4` |
| comercia-api | `sha256:6cc31f0e84e200999234877dcdcae95d79934633da0cf690d74ec6adeec0b462` |
| comercia-web | `sha256:43649c46fd1dedb440509ee85c8b816a2efded7c5c35d83aabba1332c2e8860e` |

[Descargar APK 1.2.16](http://182.160.29.45:3002/descargas/UCHECK-v1.2.16.apk)
([dirección interna](http://172.19.0.140:3002/descargas/UCHECK-v1.2.16.apk)).
[Checksum](http://182.160.29.45:3002/descargas/UCHECK-v1.2.16.apk.sha256).
HTTP 200 y tamaño exacto comprobados por ambas direcciones; checksum servido
coincide con el APK firmado. Aapt confirma paquete/versión/code y que no es
debuggable; apksigner confirma el certificado habitual. El APK anterior se conserva.

Artefactos y recuperación:
`/opt/ucheck/deployments/uweb-20261009T125440Z/`. Incluye manifiestos, fuentes,
verificaciones, imagen web anterior y, en el subdirectorio restringido comercia,
los IDs/configuración anteriores para recuperación. No publicar el respaldo de
.env. La evidencia sin credenciales está en final-verification.json; los resultados
HTTP y de APK también están en .local-presentismo, fuera del versionado.
