# Referencias ERP de usuarios

Los campos son opcionales, admiten `null` y conservan estos nombres en
PostgreSQL, en Prisma y en el contrato JSON:

| Campo | Tipo |
| --- | --- |
| `ERP_CanalVenta` | `VARCHAR(50)` |
| `ERP_Sucursal` | `INTEGER` de 32 bits |
| `ERP_Repositor` | `VARCHAR(50)` |
| `ERP_CodigoAlmacen` | `VARCHAR(100)` |
| `ERP_NombreAlmacen` | `VARCHAR(100)` |
| `ERP_CodUsuarioSap` | `VARCHAR(100)` |

Migraciones (`ALTER TABLE`, nunca se borra ni recrea la tabla):

- `20261028160000_usuarios_campos_erp`: primeros campos ERP.
- `20261106120000_usuario_erp_sucursal`: `ERP_Sucursal`.
- `20261106160000_usuario_erp_almacen_sap`: agrega `ERP_CodigoAlmacen`,
  `ERP_NombreAlmacen` y `ERP_CodUsuarioSap`; copia `ERP_Almacen` a
  `ERP_CodigoAlmacen` y quita `ERP_Almacen`, `ERP_Supervisor`, `ERP_Vendedor`
  y `ERP_Impulsador` (sus valores se pierden al aplicarla).

Se aplican mediante Prisma junto con las demás migraciones de la aplicación.

## API y Swagger

El alta y la edición individual admiten estos campos en `POST /usuarios`,
`PATCH /usuarios/:id` y sus variantes `/admin/usuarios`. La carga y edición
en lote de `/admin/usuarios` usan la misma validación por fila.
Las rutas incluyen el prefijo `/api/v1`.

Ejemplo de datos ERP que pueden acompañar el alta:

```json
{
  "ERP_CanalVenta": "1",
  "ERP_Sucursal": 1,
  "ERP_Repositor": "REP01",
  "ERP_CodigoAlmacen": "01",
  "ERP_NombreAlmacen": "DEPÓSITO CENTRAL",
  "ERP_CodUsuarioSap": "manager"
}
```

En una edición, omitir un campo conserva su valor. `null` o un texto vacío
lo borra; los textos se recortan en los extremos y conservan mayúsculas.
`ERP_Sucursal` recibe un número JSON entero entre -2147483648 y 2147483647;
`0` es válido y se conserva. Los valores que exceden los tamaños declarados,
o los campos quitados, devuelven 400 antes de llegar a la base de datos.

Swagger documenta entradas y respuestas, tanto individuales como paginadas y
en lote. El listado del ABM incluye las referencias ERP y permite buscarlas;

## Pestaña SAP

La pestaña SAP del ABM (alta y edición) muestra dos selectores con búsqueda y
paginación, del catálogo de la empresa del usuario, y tres textos libres de
hasta 100 caracteres: código de almacén, nombre de almacén y código de usuario
SAP (`ERP_CodigoAlmacen`, `ERP_NombreAlmacen`, `ERP_CodUsuarioSap`). Un texto
en blanco se guarda como `NULL`.

| Campo | Catálogo | Se guarda | Opciones |
| --- | --- | --- | --- |
| Canal de venta | `tbl_jcanales` | `Code` como texto en `ERP_CanalVenta` | `GET /usuarios/canales-venta?empresaId=` |
| Sucursal | `tbl_oclp` | `Code` en `ERP_Sucursal` (`INTEGER`, migración `20261106120000_usuario_erp_sucursal`) | `GET /usuarios/sucursales?empresaId=` |

Alta y edición devuelven 400 si el Code no existe en ese catálogo de la
empresa. La respuesta del ABM agrega `canalVentaNombre` y `sucursalNombre`.
`ERP_Repositor` no se muestra en la pestaña, pero sigue en la base y en la API
(alta, edición y lote) con las reglas de arriba.

## ABM y permisos

Los usuarios con algún dato SAP muestran el detalle “Datos SAP (ERP)”
desplegable en móvil y escritorio.
Se conservan los permisos y el aislamiento por empresa del ABM.

Son referencias externas: no cambian `superiorId` ni asignan roles. Estos campos no
se editan desde el perfil propio ni se agregan a la respuesta de sesión.

## Verificación sin base real ni navegador

```sh
npm run build
npm run test:usuarios --workspace=api
npm run test:usuarios --workspace=web
```

La comprobación de API aplica el SQL en PostgreSQL en memoria (PGlite),
comprueba que se conservan registros existentes y valida límites, HTTP y
Swagger. Las pruebas unitarias de usuarios cubren la persistencia y la
diferencia entre omitir y vaciar un dato.
