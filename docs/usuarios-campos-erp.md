# Referencias ERP de usuarios

Los seis campos son opcionales, admiten `null` y conservan estos nombres en
PostgreSQL, en Prisma y en el contrato JSON:

| Campo | Tipo |
| --- | --- |
| `ERP_CanalVenta` | `VARCHAR(50)` |
| `ERP_Almacen` | `VARCHAR(8)` |
| `ERP_Supervisor` | `VARCHAR(30)` |
| `ERP_Vendedor` | `INTEGER` de 32 bits |
| `ERP_Repositor` | `VARCHAR(50)` |
| `ERP_Impulsador` | `VARCHAR(50)` |

El `ALTER TABLE` está en
`apps/api/prisma/migrations/20261028160000_usuarios_campos_erp/migration.sql`.
Los usuarios existentes quedan con estos campos en `NULL`. La migración se
aplica mediante Prisma junto con las demás migraciones de la aplicación.

## API y Swagger

El alta y la edición individual admiten estos campos en `POST /usuarios`,
`PATCH /usuarios/:id` y sus variantes `/admin/usuarios`. La carga y edición
en lote de `/admin/usuarios` usan la misma validación por fila.
Las rutas incluyen el prefijo `/api/v1`.

Ejemplo de datos ERP que pueden acompañar el alta:

```json
{
  "ERP_CanalVenta": "MAYORISTA",
  "ERP_Almacen": "ALM01",
  "ERP_Supervisor": "SUP01",
  "ERP_Vendedor": 27,
  "ERP_Repositor": "REP01",
  "ERP_Impulsador": "IMP01"
}
```

En una edición, omitir un campo conserva su valor. `null` o un texto vacío
lo borra; los textos se recortan en los extremos y conservan mayúsculas.
`ERP_Vendedor` recibe un número JSON entero entre -2147483648 y 2147483647;
`0` es válido y se conserva. Los valores que exceden los tamaños declarados
devuelven 400 antes de llegar a la base de datos.

Swagger documenta entradas y respuestas, tanto individuales como paginadas y
en lote. El listado del ABM incluye las referencias ERP y permite buscarlas;
para vendedor, la búsqueda coincide con el código numérico completo.

## ABM y permisos

El formulario de alta/edición agrupa los campos en “Datos ERP”. Los usuarios
con datos cargados muestran ese detalle desplegable en móvil y escritorio.
Se conservan los permisos y el aislamiento por empresa del ABM.

Son referencias externas: `ERP_Supervisor` no cambia `superiorId`, y los
códigos de vendedor, repositor o impulsador no asignan roles. Estos campos no
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
