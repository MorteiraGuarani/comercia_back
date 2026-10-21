# Socios de negocio

API pública de Comercia para nueve tablas, sin login, cookie, token ni API key.
Cada ruta incluye una empresa existente y todas las operaciones se limitan a ella.
Swagger público: `/api/docs`, especificación `/api/docs-json`. Documenta las 47
operaciones, campos, restricciones, ejemplos individuales/bulk, respuestas y errores.

Se conservan las tablas y mayúsculas originales, sus tipos, longitudes, defaults y
campos nullable. `id` BIGINT permanece como metadato técnico; `empresa_id` separa
los datos. La empresa se toma de la ruta; `id`, `empresa_id` y `empresaId` no se
aceptan en el JSON de creación/edición.

## Rutas y claves

Base: `/api/v1/admin/socios-negocio/empresas/{empresaId}`.

| Tabla | GET/PUT/DELETE individual | Clave de duplicado en la empresa |
| --- | --- | --- |
| tbl_ocrd | `/tbl_ocrd/{CardCode}` | CardCode |
| tbl_crd1 | `/tbl_crd1/{CardCode}`; GET devuelve lista paginada | CardCode + Address + Street + AdresType |
| tbl_jcanales | `/tbl_jcanales/{Code}` | Code |
| tbl_jsubcanales | `/tbl_jsubcanales/{Code}` | Code |
| tbl_oagp | `/tbl_oagp/{id}` | AgentCode |
| tbl_oslp | `/tbl_oslp/{id}` | SlpCode |
| tbl_ocrg | `/tbl_ocrg/{id}` | GroupCode |
| tbl_octg | `/tbl_octg/{id}` | GroupNum |
| tbl_opln | `/tbl_opln/{id}` | ListNum |

Los códigos de socios/direcciones son texto exacto y conservan ceros iniciales.
`Code` de canales/subcanales es un entero int4. Estas rutas nunca buscan por id
técnico como alternativa. Para renombrar una clave, usar su valor original en la
URL y el nuevo en el cuerpo. Codificar caracteres especiales de la URL.

GET de colección lista con `buscar`, `page` y `limit`; los resultados tienen
`{items,total,page,limit,totalPages}`, con 7 filas por defecto y máximo 50.
POST de colección admite un objeto o un arreglo bulk. PUT cambia los campos
enviados y conserva los omitidos. DELETE respeta las referencias conocidas.

## Direcciones por CardCode

`GET /tbl_crd1/0001?page=1&limit=7` devuelve todas las direcciones de ese código
en la empresa, incluso cuando el socio principal todavía no haya sido importado.
La ruta conserva hasta 200 caracteres de CardCode, como la tabla original.

PUT y DELETE operan sobre una dirección. Si el código tiene exactamente una,
no hace falta selector. Si tiene varias, devuelven 409 sin modificar ni borrar
ninguna hasta que se indique el parámetro `direccion` con la clave completa
original, codificada como JSON:

```json
{"Address":"Casa central","Street":"Av. Mariscal López 123","AdresType":"S"}
```

Ejemplo en JavaScript:

```js
const selector = encodeURIComponent(JSON.stringify({
  Address: null, Street: 'Calle anterior', AdresType: 'S'
}));
// El cuerpo PUT contiene los valores nuevos; el selector conserva los originales.
const url = `/api/v1/admin/socios-negocio/empresas/1/tbl_crd1/0001?direccion=${selector}`;
```

Los tres campos deben estar presentes y admitir texto de hasta 200 caracteres
o null. NULL se distingue del texto literal `"null"`. No se permiten claves
desconocidas. Un selector sin coincidencias devuelve 404. GET también admite
este selector para filtrar una dirección dentro de su lista paginada.
Las filas históricas con CardCode NULL siguen visibles en la colección; la ruta
por código requiere un CardCode textual. Las columnas originales no cambian.

## Bulk y validación

Un objeto devuelve la fila con 201 o 409 si la clave ya existe. Un arreglo admite
entre 1 y 50.000 filas y hasta 50 MiB por defecto (`HTTP_BODY_LIMIT_MB`). Se valida
todo antes de escribir. Conserva la primera aparición y omite claves existentes
sin actualizarlas. Los bloques de 1.000 filas se escriben en una transacción;
cualquier fallo revierte el lote. Respuesta de ejemplo:

```json
{"recibidos":3,"insertados":1,"existentes":1,"duplicadosEnLote":1,"omitidos":2}
```

Una fila inválida devuelve 400 con `index` desde cero y `details`. Un cuerpo grande
devuelve 413; se conserva el límite global de solicitudes (429). El límite ampliado
solo corresponde a POST de colección de las nueve tablas. No se aceptan campos
desconocidos. Los enteros del JSON deben ser números; coordenadas y códigos de canal
de tbl_ocrd se envían como texto. `null` conserva NULL en columnas nullable.

Al omitir campos al crear, GroupNum/SlpCode toman -1, los indicadores de días toman
N y AdresType toma S. En las dos tablas plurales, Code puede omitirse al crear:
la API asigna el siguiente positivo por empresa, reservando los códigos explícitos
del mismo lote y serializando las escrituras. Para bulk idempotente enviar Code.

## Relaciones

`GET /tbl_ocrd/{CardCode}/relaciones` resuelve catálogos en la misma empresa:

| Campo | Catálogo |
| --- | --- |
| GroupCode | tbl_ocrg.GroupCode |
| GroupNum | tbl_octg.GroupNum |
| ListNum | tbl_opln.ListNum |
| SlpCode | tbl_oslp.SlpCode |
| AgentCode | tbl_oagp.AgentCode |
| U_jCANAL | tbl_jcanales.Code |
| U_jSUBCANAL | tbl_jsubcanales.Code |

Los campos U_jCANAL/U_jSUBCANAL conservan su texto: `"001"` resuelve Code=1 si
representa un int4. Valores no numéricos o referencias ausentes devuelven null.
No se inventan registros para -1. Las referencias son lógicas para permitir
importaciones parciales; empresa_id tiene FK obligatoria. Los catálogos usados
y socios con direcciones no pueden eliminarse ni cambiar su clave (409).
`GET /tbl_ocrd/{CardCode}/direcciones` lista las direcciones del socio con paginación.

## Migración

`20261021200000_canales_plurales` importa los códigos singulares en las tablas
plurales dentro de cada empresa, preserva nombres existentes compatibles y
completa nombres NULL. Si encuentra nombres distintos no nulos para la misma
empresa/Code, aborta antes de eliminar tablas. Luego ejecuta DROP TABLE de
tbl_jcanal y tbl_jsubcanal, sin CASCADE. Las referencias textuales de socios
permanecen intactas y pasan a resolver los plurales. Se mantienen las migraciones
históricas para reproducir la evolución de la base.

Verificación sin navegador: compilación, pruebas del servicio y
`npm run test:socios --workspace=api`. Incluye PostgreSQL aislado, preservación
de datos en la migración, conflictos, empresa, NULL, bulk, Swagger y HTTP.
