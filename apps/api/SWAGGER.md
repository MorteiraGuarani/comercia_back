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
  devolviendo 400, registros no disponibles 404 y duplicados 409.
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

La sección **Precios especiales** conserva sus permisos de superadmin y su
contrato propio; no forma parte de la etiqueta **Productos y precios**.
