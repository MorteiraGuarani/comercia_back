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
Versión APK 1.2.16, versionCode 27. Compilación firmada iniciada. Verificación
visual y prueba en Android físico pendientes, sin navegador ni dispositivo.
