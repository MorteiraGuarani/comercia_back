# Socios de negocio

API de Comercia para las once tablas del catálogo de socios. Todas las operaciones
son públicas: no requieren login, cookie, token ni API key. Cada ruta incluye una
empresa existente y todas las lecturas, escrituras y relaciones se limitan a ella.
La lista pública de empresas está en `GET /api/v1/admin/catalogo/empresas`.

Swagger está en `/api/docs` cuando `SWAGGER_ENABLED=true`; la especificación está en
`/api/docs-json`. Hay un grupo por tabla, 57 operaciones documentadas, descripciones
de todos los campos, restricciones, ejemplos individuales y bulk y respuestas.

## Tablas y claves

Se conservan los nombres y mayúsculas originales de tablas y columnas, sus tipos,
longitudes, campos nullable y valores predeterminados. Se agregan `id` BIGINT como
clave técnica y `empresa_id` para separar los datos, igual que productos. La API
devuelve `id` como texto para conservar precisión; la empresa se toma de la ruta y
no se acepta `id`, `empresa_id` ni `empresaId` en el JSON.

| Tabla | Contenido | Clave de duplicado dentro de una empresa |
| --- | --- | --- |
| `tbl_ocrd` | Socios de negocio | `CardCode` |
| `tbl_crd1` | Direcciones | `CardCode`, `Address`, `Street`, `AdresType` |
| `tbl_jcanal` | Canal canónico | `Code` |
| `tbl_jcanales` | Catálogo independiente de canales | `Code` |
| `tbl_jsubcanal` | Subcanal canónico | `Code` |
| `tbl_jsubcanales` | Catálogo independiente de subcanales | `Code` |
| `tbl_oagp` | Supervisores | `AgentCode` |
| `tbl_oslp` | Vendedores | `SlpCode` |
| `tbl_ocrg` | Grupos de clientes | `GroupCode` |
| `tbl_octg` | Condiciones de pago | `GroupNum` |
| `tbl_opln` | Listas de precios | `ListNum` |

En `tbl_crd1`, la clave compuesta permite omitir filas idénticas al reintentar un
lote y conservar direcciones distintas aunque no tengan `Address`. Para corregir
una dirección existente se usa su `id` con PUT; un bulk no sobrescribe calles.
En claves nullable, dos valores NULL se consideran duplicados dentro de la empresa.

## Rutas

Base: `/api/v1/admin/socios-negocio/empresas/{empresaId}/{tabla}`.

| Método | Ruta relativa | Comportamiento |
| --- | --- | --- |
| GET | `/` | Lista con `buscar`, `page`, `limit` |
| GET | `/{id}` | Consulta una fila por su ID técnico |
| POST | `/` | Crea un objeto o carga un arreglo bulk |
| PUT | `/{id}` | Cambia los campos enviados; conserva los omitidos |
| DELETE | `/{id}` | Elimina la fila si no tiene referencias conocidas |
| GET | `tbl_ocrd/{id}/relaciones` desde la ruta de empresa | Resuelve los catálogos del socio |
| GET | `tbl_ocrd/{id}/direcciones` desde la ruta de empresa | Lista sus direcciones con paginación |

Los listados devuelven `{items,total,page,limit,totalPages}`. El límite es 7 por
defecto y 50 como máximo. `buscar` filtra campos de texto y, donde corresponde, la
clave numérica del catálogo. No hay listados sin límite.

## Carga individual y bulk

Ejemplo de alta de socio, sin encabezado de autorización:

```http
POST /api/v1/admin/socios-negocio/empresas/1/tbl_ocrd
Content-Type: application/json

{
  "CardCode": "C0001",
  "CardName": "Comercial del Centro",
  "GroupCode": 1,
  "GroupNum": 1,
  "LicTradNum": "80012345-6",
  "ListNum": 1,
  "SlpCode": 1,
  "AgentCode": "SUP01",
  "QryLunes": "Y",
  "U_Latitud": "-25.2867",
  "U_Longitud": "-57.6470",
  "U_jCANAL": "1",
  "U_jSUBCANAL": "1"
}
```

Un objeto devuelve la fila creada con 201. Si su clave ya existe en esa empresa,
devuelve 409. Para bulk se envía un arreglo al mismo endpoint:

```json
[
  { "CardCode": "C0001", "CardName": "Comercial del Centro" },
  { "CardCode": "C0002", "CardName": "Distribuidora del Sur" },
  { "CardCode": "C0002", "CardName": "Duplicado que se omite" }
]
```

Si C0001 ya existe y C0002 es nuevo, responde 201 con:

```json
{
  "recibidos": 3,
  "insertados": 1,
  "existentes": 1,
  "duplicadosEnLote": 1,
  "omitidos": 2
}
```

Se valida el lote completo antes de escribir. Se conserva la primera aparición de
cada clave y se omiten las existentes sin actualizarlas. Los bloques de 1.000 filas
se escriben en una única transacción: un fallo revierte la carga completa.

El máximo es 50.000 filas por solicitud. El JSON puede ocupar hasta 50 MiB por
defecto, según `HTTP_BODY_LIMIT_MB`. Ese límite ampliado solo corresponde al POST
de colección de las once tablas; PUT y otras rutas conservan el límite general.

Los números deben enviarse como números JSON, y las coordenadas y códigos de canal
de `tbl_ocrd` como texto. No se admiten campos desconocidos. Una fila inválida causa
400 e incluye `index` comenzando en cero y `details`. Un cuerpo demasiado grande
causa 413; se mantiene el límite global de solicitudes con respuesta 429.

Al omitir valores al crear un socio, `GroupNum` y `SlpCode` toman -1 y los cinco
indicadores de días toman `N`. En direcciones, `AdresType` toma `S`. En campos
nullable, enviar `null` guarda NULL; no aplica el valor predeterminado.

En las cuatro tablas de canales, `Code` admite un entero explícito o puede omitirse
al crear. La API asigna el siguiente código positivo después del máximo de esa
empresa, reservando también los códigos explícitos del mismo lote. Esta asignación
se serializa por empresa. Filas sin `Code` representan nuevas filas: repetirlas
vuelve a insertar; para una sincronización idempotente se debe enviar `Code`.

## Relaciones

Todas se resuelven con la misma empresa del socio:

| Campo en `tbl_ocrd` | Destino |
| --- | --- |
| `CardCode` | `tbl_crd1.CardCode` para sus direcciones |
| `GroupCode` | `tbl_ocrg.GroupCode` |
| `GroupNum` | `tbl_octg.GroupNum` |
| `ListNum` | `tbl_opln.ListNum` |
| `SlpCode` | `tbl_oslp.SlpCode` |
| `AgentCode` | `tbl_oagp.AgentCode` |
| `U_jCANAL` | `tbl_jcanal.Code` si el texto representa un entero int4 |
| `U_jSUBCANAL` | `tbl_jsubcanal.Code` si el texto representa un entero int4 |

`"001"` referencia Code=1 conservando el texto original. Los valores no numéricos
se conservan y no resuelven un catálogo. `tbl_jcanales` y `tbl_jsubcanales` son
catálogos independientes; no se presupone una relación entre singular y plural.

Las referencias de negocio son lógicas, sin claves foráneas entre las once tablas,
para permitir cargas parciales o en cualquier orden. Una referencia no cargada o
nula aparece como `null` en `/relaciones`. No se crean registros ficticios para -1;
si existe un catálogo con ese código se devuelve normalmente. La empresa sí tiene
clave foránea obligatoria. La API impide eliminar o cambiar la clave de catálogos
canónicos usados, o de socios que todavía tienen direcciones, devolviendo 409.

## Migración y verificación

La migración `20261021170000_socios_negocio` crea las once tablas. Requiere PostgreSQL
15 o superior por los índices `NULLS NOT DISTINCT`, necesarios para la idempotencia
de claves nullable. Esta propiedad se conserva en el SQL de migración y se verifica
con una prueba aislada. No ejecutar los CREATE TABLE originales adicionalmente.

Para aplicar migraciones en el entorno elegido se usa el procedimiento habitual
`npm run prisma:deploy --workspace=api`. Esta implementación no aplica cambios en
la base de producción por sí sola.

Desde la raíz del repositorio:

```bash
npm run prisma:generate --workspace=api
npm run build --workspace=api
npm run test --workspace=api -- --runInBand socios-negocio.service.spec.ts
npm run test:socios --workspace=api
```

Las pruebas de migración usan PostgreSQL aislado con PGlite, y las HTTP arrancan una
API temporal con repositorios simulados: no requieren navegador ni la base del
usuario. Verifican las 57 operaciones, Swagger, ejemplos, validación y tamaño de
cuerpo. Las pruebas del servicio verifican separación por empresa, referencias,
códigos automáticos y resumen bulk. El pipeline de despliegue ejecuta estas pruebas.
