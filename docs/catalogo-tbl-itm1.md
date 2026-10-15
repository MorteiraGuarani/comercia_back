# Catálogo de artículos y listas de precios

`tbl_itm1` reúne los datos que antes estaban en `productos` y `precios`.
Usa los nombres y tipos del DDL de origen, sin el prefijo `convertia`:

| Campo | Tipo | Nulo / valor predeterminado |
| --- | --- | --- |
| id | BIGSERIAL, clave primaria | No |
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

Se conserva `empresa_id`, por decisión del usuario, y el único
`uq_tbl_itm1_item_pricelist` cubre `(empresa_id, itemcode, pricelist)`.
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
