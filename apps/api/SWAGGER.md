# Documentacion de la API

- Interfaz: `/api/docs`.
- OpenAPI JSON: `/api/docs-json`.
- OpenAPI YAML: `/api/docs-yaml`.
- Se activa con `SWAGGER_ENABLED=true`; `false` elimina las tres rutas.
- La interfaz, sus archivos y las especificaciones JSON/YAML son públicos,
  también en producción. Se pueden consultar sin sesión ni token, incluso
  si el navegador conserva una cookie expirada. No se cachea la documentación.
- Los permisos de los endpoints siguen vigentes. Abrir la documentacion no
  autoriza ejecutar una operacion que el usuario no pueda realizar. Para usar
  endpoints protegidos desde Swagger se necesita una sesión válida o un token
  Bearer con los permisos correspondientes. La sección **Productos y precios**
  es pública también para ejecutar sus operaciones, por petición del usuario.
- Los DTOs y sus validaciones se documentan mediante el plugin de compilacion
  de `@nestjs/swagger`. No se generan esquemas a partir de modelos Prisma.
- Prueba aislada: `npm run build --workspace=api` y luego
  `npm run test:swagger --workspace=api`. No usa la base de produccion.

Produccion: https://api.comercia.pro/api/docs

Referencia del plugin: https://docs.nestjs.com/openapi/cli-plugin

## Tamaño de las solicitudes

- Todos los endpoints aceptan cuerpos JSON y `application/x-www-form-urlencoded`
  de hasta **50 MiB (52.428.800 bytes)** por defecto. Se configura con
  `HTTP_BODY_LIMIT_MB` (entero de 1 a 256); Docker Compose también propaga ese valor.
- El tamaño incluye espacios y saltos de línea; para `gzip` se aplica al contenido
  descomprimido. Un cuerpo mayor devuelve 413 con `limitBytes` y un mensaje con el
  límite configurado. El límite de formularios es de 100.000 parámetros.
- El proxy delante de la API debe permitir al menos ese mismo tamaño.
- Varios objetos se envían como un único arreglo JSON `[{...}, {...}]`, con
  `Content-Type: application/json`. Objetos consecutivos sin `[]` son JSON inválido
  y devuelven 400; el límite de tamaño puede producir 413 antes de validar el JSON.
- Cada endpoint conserva sus DTOs y permisos. Los archivos `multipart/form-data`
  conservan sus límites específicos de imágenes y adjuntos.
- Prueba HTTP sin base de datos: `npm run test:http-body --workspace=api` después
  de compilar. Comprueba el límite de 50 MiB, formularios y JSON comprimido.

## Catálogo de artículos (`tbl_itm1`)

- Una fila por artículo y lista de precios dentro de cada empresa. La tabla no
  usa el esquema `convertia`; se conserva `empresa_id` para separar empresas.
- Base: `/api/v1/admin/catalogo/empresas/:empresaId/productos`.
  `GET` lista, `POST` crea y `PUT /:id` / `DELETE /:id` modifican o eliminan
  solamente esa fila. Todos los endpoints de **Productos y precios** funcionan
  sin sesión, token ni permisos de superadmin, también desde Postman:
  `GET /empresas`, `GET /empresas/:empresaId/productos/opciones`,
  `GET/POST /empresas/:empresaId/productos` y
  `PUT/DELETE /empresas/:empresaId/productos/:id`, bajo `/api/v1/admin/catalogo`.
- La empresa de la ruta debe existir; datos y parámetros inválidos siguen
  devolviendo 400 y registros no disponibles 404. El POST individual y el PUT
  conservan el conflicto 409 para combinaciones duplicadas.
- `POST` acepta un objeto o un arreglo de 1 a 50.000 objetos en la misma ruta,
  dentro del límite de tamaño HTTP configurado.
  Para un objeto devuelve 201 con el producto. Para un arreglo devuelve 201
  con `{ recibidos, insertados, existentes, duplicadosEnLote, omitidos }`,
  incluso cuando todos ya existen. Omite las combinaciones existentes en esa
  empresa y continúa con las nuevas; no sobrescribe nombres ni precios.
  Las repeticiones de la misma pareja dentro del arreglo se cuentan como
  `duplicadosEnLote` y prevalece la primera aparición. `existentes` cuenta
  combinaciones únicas no insertadas, incluidas las de envíos concurrentes.
  `omitidos = existentes + duplicadosEnLote` y `recibidos = insertados + omitidos`.
  Cada elemento se valida antes de escribir: una fila inválida devuelve 400
  con `index` (desde 0) y no inserta ninguna fila del lote.
  Se inserta en bloques de 1.000 dentro de una única transacción con hasta 120 s
  de ejecución; un error real de base de datos en un bloque posterior también
  revierte los anteriores. Los duplicados no son errores del lote.
- La clave primaria es compuesta por `(empresa_id, itemcode, pricelist)`.
  Dentro de una empresa se permite `A0001` con lista 1 y con lista 2; repetir
  `A0001` con lista 1 devuelve 409 al crear un objeto individual o editar;
  al enviar un arreglo, se omite y se incluye en el resumen.
  `id` continúa siendo único y autogenerado para mantener las URLs existentes.
- Campos de entrada: `itemcode`, `itemname`, `iva`, `itmsgrpcode`, `itmsgrpnam`,
  `inventory`, `pricelist`, `pricelistname`, `price`, `tipo`. `empresa_id` se
  obtiene de la ruta, nunca del cuerpo.
- Obligatorios: `itemcode`, `itemname`, `iva`, `itmsgrpcode`, `pricelist`.
  Los demás admiten `null`; `inventory` usa `Y` si se omite al crear.
  En `PUT`, los campos opcionales omitidos conservan su valor; `null` los vacía.
- En el cuerpo de entrada, `iva` y `pricelist` son enteros SMALLINT;
  `itmsgrpcode` es un entero INTEGER; `price` es un número NUMERIC(21,6).
  Los VARCHAR y `inventory` (CHAR(1)) son texto, con los largos del DDL.
- `id` se genera automáticamente y no se envía al crear. En las respuestas,
  `id` y `price` siguen serializándose como texto para conservar BIGINT y los
  21 dígitos del decimal; `price` usa 6 decimales o `null`. También se admite
  texto decimal exacto en la entrada por compatibilidad con el panel existente.
- Filtros: `buscar` (código/nombre/lista), `itemcode`, `pricelist`, `page`,
  `limit`. La lista devuelve `{ items, total, page, limit, totalPages }`.
- El antiguo CRUD separado `/precios` se reemplaza por estos registros y
  editar/eliminar usa `id`, en lugar del anterior `cardCode`.
- Migración y condiciones de aplicación: [catálogo tbl_itm1](../../docs/catalogo-tbl-itm1.md).

Ejemplo de cuerpo para `POST /api/v1/admin/catalogo/empresas/1/productos`
(usar una empresa existente), sin cabecera Authorization:

```json
{
  "itemcode": "A0001",
  "itemname": "Artículo de ejemplo",
  "iva": 10,
  "itmsgrpcode": 100,
  "itmsgrpnam": "Alimentos",
  "inventory": "Y",
  "pricelist": 1,
  "pricelistname": "General",
  "price": 15000.123456,
  "tipo": "Artículo"
}
```

Para crear varias listas de un mismo artículo, enviar directamente un arreglo:

```json
[
  { "itemcode": "AV00018", "itemname": "PAPAS TRAD. 9,5 MM 4X2.5 KG-XL", "iva": 10, "itmsgrpcode": 143, "pricelist": 13, "price": 141650, "tipo": null },
  { "itemcode": "AV00018", "itemname": "PAPAS TRAD. 9,5 MM 4X2.5 KG-XL", "iva": 10, "itmsgrpcode": 143, "pricelist": 14, "price": 141650, "tipo": null }
]
```

Que ya exista `AV00018` con lista 11 no impide crear las listas 13 y 14.

Ejemplo de respuesta de un lote de 20.000 objetos con 200 combinaciones existentes:

```json
{
  "recibidos": 20000,
  "insertados": 19800,
  "existentes": 200,
  "duplicadosEnLote": 0,
  "omitidos": 200
}
```

El resumen reemplaza el arreglo de productos en la respuesta del bulk.
Reenviar el mismo lote es seguro: los existentes se omiten sin modificarlos.

La sección **Precios especiales** conserva sus permisos de superadmin y su
contrato propio; no forma parte de la etiqueta **Productos y precios**.

## Inventario del impulsador

`GET /api/v1/campo/inventario/items` requiere sesión y acceso a la página
**Mi jornada · Inventario** (migración
`20261016150000_pagina_inventario_mi_jornada`). Devuelve todas las filas de
`tbl_itm1` de la empresa del usuario, sin filtrar: un artículo aparece una vez
por cada lista de precios, ordenado por código y lista
(`{ items: [{ id, itemcode, itemname, pricelist, pricelistname, price }], total }`).
`id` y `price` viajan como texto, igual que en Productos y precios.

Es una excepción a la paginación obligatoria, por pedido explícito del usuario:
la web guarda el catálogo completo en IndexedDB con Dexie para usarlo sin
conexión. Tiene un tope de 50.000 artículos y responde 413 antes que truncar.
La web lo renueva al menos una vez por día calendario y reemplaza la copia
anterior solo cuando la descarga terminó.
