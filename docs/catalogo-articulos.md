# Artículos y precios

`tbl_oitm` es el maestro oficial. `tbl_itm1` contiene exclusivamente los precios
por lista. Las tablas activas permanecen en el esquema actual (`public`), con los
nombres y mayúsculas solicitados y los campos técnicos `id` y `empresa_id`.

## Contrato

Base pública para artículos y precios:
`/api/v1/admin/catalogo/empresas/{empresaId}/tbl_oitm` y `/tbl_itm1`.
`tbl_ospp`, `tbl_spp1` y `tbl_spp2` conservan sesión y superadministrador activo,
como los precios especiales anteriores. Todas las tablas tienen GET paginado,
GET por clave de negocio, POST individual/bulk, PUT, PATCH parcial y DELETE. Bulk valida todo
antes de escribir, admite hasta 50.000 filas y 50 MiB por defecto, conserva la
primera aparición de cada clave y omite las existentes sin actualizarlas.
Los listados usan 7 filas por defecto y un máximo de 50.

Swagger `/api/docs` documenta todas las operaciones, ejemplos, autenticación,
campos obligatorios, nullable, defaults, límites y errores. `id` y los decimales
viajan como texto; los decimales tienen seis posiciones. En solicitudes se admite
también un número JSON dentro de NUMERIC(21,6). Se recomienda texto para conservar
los 21 dígitos exactos. No se aceptan campos desconocidos ni empresa/id en el JSON.

| Tabla | Clave dentro de la empresa | Relación |
| --- | --- | --- |
| tbl_oitm | ItemCode | Maestro de artículos, código de hasta 15 caracteres |
| tbl_itm1 | ItemCode + PriceList | FK al maestro de la misma empresa; maestro debe cargarse primero |
| tbl_ospp | ItemCode + CardCode + ListNum | Referencias lógicas a artículo, socio y lista |
| tbl_spp1 | ItemCode + CardCode + ListNum + LINENUM | Líneas relacionadas lógicamente con tbl_ospp |
| tbl_spp2 | ItemCode + CardCode | Una promoción por artículo y socio, como indica la clave suministrada |

GET individual, PUT, PATCH y DELETE usan estos sufijos después de la tabla:

| Tabla | Sufijo de ruta |
| --- | --- |
| tbl_oitm | `/{ItemCode}` |
| tbl_itm1 | `/{ItemCode}/{PriceList}` |
| tbl_ospp | `/{ItemCode}/{CardCode}/{ListNum}` |
| tbl_spp1 | `/{ItemCode}/{CardCode}/{ListNum}/{LINENUM}` |
| tbl_spp2 | `/{ItemCode}/{CardCode}` |

Ejemplo: `GET /api/v1/admin/catalogo/empresas/2/tbl_itm1/AV00018/13`.
Los códigos son texto exacto (incluidos los ceros iniciales); codificar caracteres
especiales con `encodeURIComponent`. La clave completa evita modificar otras listas,
líneas, socios o empresas. No existe búsqueda alternativa por el id de PostgreSQL.
Para renombrar una clave se usa la original en la URL y la nueva en el cuerpo.
El id técnico se conserva como metadato de lectura y en la base, sin uso en estas rutas.

Los socios principales usan `/{CardCode}` después de
`/api/v1/admin/socios-negocio/empresas/{empresaId}/tbl_ocrd`, también en
`/{CardCode}/relaciones` y `/{CardCode}/direcciones`. `tbl_crd1/{CardCode}` lista
direcciones paginadas; PUT/DELETE permiten elegir una con el selector JSON
`direccion` (Address/Street/AdresType originales). Si hay varias y no se indica
selector, devuelven 409 sin cambios. Canales y subcanales usan únicamente las
tablas plurales y rutas por `Code`. Véase [socios de negocio](socios-negocio.md).

`SPP1Lnum` no incluye ListNum: puede coincidir con líneas de distintas listas. No
se inventa una lista ni se agrega esa columna a tbl_spp2. La estructura nueva de
tbl_spp1 no contiene fechas; se retiran fromdate/todate del contrato activo.
Las referencias especiales son lógicas para permitir importaciones parciales.
Se protege la eliminación/cambio de claves de filas con referencias existentes.
El cambio de ItemCode del maestro actualiza sus precios mediante ON UPDATE CASCADE;
la eliminación del maestro con precios se rechaza con 409.

## Compatibilidad y migración

La ruta `/productos` sigue siendo el adaptador de la pantalla existente: relaciona
tbl_oitm y tbl_itm1. Los ID de precio y los importes se conservan. Editar datos
generales afecta al maestro compartido por sus listas. Eliminar desde esta pantalla
elimina únicamente el precio de esa lista; el maestro permanece.
PUT y DELETE de la pantalla usan `/productos/{ItemCode}/{PriceList}`.
El formulario conserva esa pareja original aunque se editen sus valores.
Los nombres de listas se guardan y consultan en tbl_opln.ListName. `itmsgrpnam`
se retira del formulario y del almacenamiento activo; el campo antiguo de respuesta
queda en null por compatibilidad. Para integraciones nuevas usar las rutas por
nombre de tabla y los nombres exactos de campos, no el contrato de la pantalla.
Los alias `/precios-especiales` y `/precios-especiales-detalle` conservan sus URL
y permisos, pero ahora reciben los nombres y claves del contrato nuevo.

La migración aborta si encuentra códigos mayores a 15 caracteres, grupos fuera
de int2, metadatos contradictorios entre listas, claves incompletas o duplicadas
en precios especiales. No trunca ni elimina esas filas automáticamente. Crea una
copia íntegra de las tres tablas anteriores en `respaldo_catalogo_20261021`, fuera
del esquema activo de la aplicación y sin acceso para PUBLIC. Este respaldo
conserva nombres de grupos y fechas retiradas, además del backup externo previo
al despliegue. No se usa como origen de datos de los endpoints nuevos.

## Ajuste de la pantalla existente

Propósito: gestionar artículo y precio de una lista sin duplicar sus datos
generales. Usuarios administrativos en escritorio y móvil. Se conserva el tono
operativo y el sistema existente: Manrope, los componentes compartidos, fondo
`#e8dfd3`, texto `#211c18` y acento `#c98248`, con sus variantes oscuras. Se mantiene
la tabla paginada, la lista móvil, el modal y el espaciado actual. El cambio visible
es retirar el nombre de grupo y explicar los campos compartidos. Se ajustan los
límites de códigos y enteros; no se añaden fuentes ni movimiento. Verificación
mediante código, pruebas de formulario y compilación, sin navegador.

La adaptación de rutas mantiene el mismo propósito, audiencia, tono y sistema.
La identidad visible sigue siendo código y lista; cambia el identificador enviado
al guardar o eliminar. Se conserva el modal, la accesibilidad y los estados actuales.
