# Catálogo de artículos y listas de precios

`tbl_itm1` reúne los datos que antes estaban en `productos` y `precios`.
Usa los nombres y tipos del DDL de origen, sin el prefijo `convertia`:

| Campo | Tipo | Nulo / valor predeterminado |
| --- | --- | --- |
| id | BIGSERIAL, identificador único | No |
| empresa_id | INTEGER, FK a empresas | No |
| itemcode | VARCHAR(50) | No |
| itemname | VARCHAR(200) | No |
| iva | SMALLINT | No |
| itmsgrpcode | INTEGER | No |
| itmsgrpnam | VARCHAR(200) | Sí |
| inventory | CHAR(1) | Sí, predeterminado `Y` |
| pricelist | SMALLINT | No |
| pricelistname | VARCHAR(200) | Sí |
| price | NUMERIC(21,6) | Sí |
| tipo | VARCHAR(50) | Sí |

Se conserva `empresa_id`, por decisión del usuario. La clave primaria compuesta
`tbl_itm1_pkey` cubre `(empresa_id, itemcode, pricelist)`: un mismo `itemcode`
puede existir en las listas 1 y 2 de una empresa, pero no dos veces en la misma
lista. Otra empresa conserva su propio catálogo. `id` sigue autogenerándose y
es único mediante `uq_tbl_itm1_id`; permite conservar las URLs y los selectores
existentes sin cambiar los IDs de ninguna fila.
Los cinco índices del DDL conservan sus nombres. La API y el panel usan los
nombres de los campos. El cuerpo de entrada acepta `price` numérico; las
respuestas conservan IDs y precios como texto para evitar redondeos. También
se admite la entrada decimal como texto por compatibilidad con el panel.

Los seis endpoints de **Productos y precios** son públicos por petición del
usuario, incluido POST/PUT/DELETE. Se mantiene la validación de parámetros,
DTOs, existencia de empresa y separación de filas por empresa. La sección
**Precios especiales** conserva autenticación y permisos de superadmin.

## Migración

[20261015160000_catalogo_tbl_itm1](../apps/api/prisma/migrations/20261015160000_catalogo_tbl_itm1/migration.sql)
es una migración nueva; las migraciones anteriores no se modifican.

En una única transacción se bloquean las tablas, se renombra `precios` a
`tbl_itm1`, se conservan sus IDs, se amplía la secuencia a BIGINT y se renombran
los campos. Los atributos se copian desde `productos` usando empresa y código.
`inventario=true/false` pasa a `inventory=Y/N`. Al terminar se retira la tabla
`productos`, cuyos datos ya están en `tbl_itm1`.

Los productos sin precios se conservan como filas con `pricelist=0`,
`pricelistname=NULL` y `price=NULL`. Es una asignación de migración para no
perder esos artículos: se puede completar la lista desde el panel.

La migración falla antes de alterar las tablas si encuentra varias tarifas
para la misma empresa, código y lista, números de lista fuera de SMALLINT o
tipos con más de 50 caracteres. No elige un precio arbitrario ni trunca textos.
Las verificaciones y la transacción impiden cambios parciales. Para revisar
los casos incompatibles antes del despliegue:

```sql
SELECT empresa_id, cardcode, nro_lista_precio, count(*)
FROM precios GROUP BY empresa_id, cardcode, nro_lista_precio HAVING count(*) > 1;
SELECT id, empresa_id, cardcode, nro_lista_precio
FROM precios WHERE nro_lista_precio NOT BETWEEN -32768 AND 32767;
SELECT empresa_id, cardcode, tipo FROM productos WHERE char_length(tipo) > 50;
```

Después de resolver esos casos, se aplica por el proceso habitual
`prisma migrate deploy` junto con la versión de API y web que usa el nuevo
contrato. Los clientes externos deben reemplazar `/precios` y las propiedades
anteriores por `/productos` con los campos de `tbl_itm1`; edición y borrado
usan el ID de la fila, no el código del artículo.

## Conversión a clave primaria compuesta

[20261015200000_tbl_itm1_clave_compuesta](../apps/api/prisma/migrations/20261015200000_tbl_itm1_clave_compuesta/migration.sql)
convierte la clave única de negocio en la clave primaria de la tabla, dentro
de una transacción. Conserva todas las filas, IDs, secuencia, tipos, índices de
búsqueda y FK a empresas. No elimina ni fusiona productos. La restricción
única anterior queda reemplazada por la PK, que impone la misma regla por
empresa, artículo y lista. `id` pasa de clave primaria a identificador único.

POST y PUT devuelven 409 si la combinación ya existe en esa empresa. Editar
por `id` puede cambiar de lista si la combinación nueva está libre; borrar una
fila no borra las demás listas del mismo artículo.

## Verificación aislada

`npm run test:productos --workspace=api` ejecuta SQL real en PGlite sin usar
la base configurada. Comprueba conservación, rollback, unicidad, tipos,
secuencia BIGINT, nulos y separación por empresa y lista. Los tests de
`productos` verifica acceso sin sesión y validación; `precios-especiales`
verifica sus permisos. `test:swagger` prueba los seis endpoints del catálogo
por HTTP, los tipos de los ejemplos y la entrada de precios numéricos.

El panel conserva los componentes y tokens de Comercia: IBM Plex Sans/Mono,
fondo `#e8dfd3`, texto `#211c18`, acento `#c98248` y modo oscuro existente.
La tabla de escritorio y lista móvil comparten las mismas filas paginadas;
el formulario agrupa artículo y precio en una sola operación.
