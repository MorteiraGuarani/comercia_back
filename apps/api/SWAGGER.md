# Documentacion de la API

- Interfaz: `/api/docs`.
- OpenAPI JSON: `/api/docs-json`.
- OpenAPI YAML: `/api/docs-yaml`.
- Se activa con `SWAGGER_ENABLED=true`; `false` elimina las tres rutas.
- En produccion requiere una sesion vigente de superadmin: cookie de la API
  obtenida al iniciar sesion en Comercia, o `Authorization: Bearer <token>`.
  Tambien se protegen los archivos de Swagger; no se cachea la documentacion.
- Los permisos de los endpoints siguen vigentes. Abrir la documentacion no
  autoriza ejecutar una operacion que el usuario no pueda realizar.
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
  solamente esa fila. Requiere superadmin activo.
- Campos de entrada: `itemcode`, `itemname`, `iva`, `itmsgrpcode`, `itmsgrpnam`,
  `inventory`, `pricelist`, `pricelistname`, `price`, `tipo`. `empresa_id` se
  obtiene de la ruta, nunca del cuerpo.
- Obligatorios: `itemcode`, `itemname`, `iva`, `itmsgrpcode`, `pricelist`.
  Los demás admiten `null`; `inventory` usa `Y` si se omite al crear.
  En `PUT`, los campos opcionales omitidos conservan su valor; `null` los vacía.
- `id` (BIGSERIAL) y `price` (NUMERIC(21,6)) viajan como texto. `price` admite
  signo, hasta 15 enteros y 6 decimales; la respuesta usa 6 decimales o `null`.
- Filtros: `buscar` (código/nombre/lista), `itemcode`, `pricelist`, `page`,
  `limit`. La lista devuelve `{ items, total, page, limit, totalPages }`.
- El antiguo CRUD separado `/precios` se reemplaza por estos registros y
  editar/eliminar usa `id`, en lugar del anterior `cardCode`.
- Migración y condiciones de aplicación: [catálogo tbl_itm1](../../docs/catalogo-tbl-itm1.md).
