# Actualización de grupos de artículos OITB

La tabla `tbl_oitb` recibe `Number` (entero int4 obligatorio) y `GroupName`
(texto de hasta 200 caracteres, opcional). La migración elimina sus registros
anteriores antes de cambiar las columnas. Conserva el identificador interno,
la empresa y la unicidad por empresa y `Number`.

El endpoint público `/api/v1/admin/catalogo/empresas/{empresaId}/tbl_oitb`
acepta los nuevos nombres en cargas individuales y bulk. GET, PUT y DELETE
individuales usan la ruta `/{Number}`; el filtro `buscar` consulta el nombre
o el número. Swagger presenta los mismos campos, reglas y ejemplos. Los nombres
anteriores no se aceptan en el cuerpo de esta tabla. `tbl_oitm.ItmsGrpCod`
mantiene su propio contrato.

La migración se comprueba en PostgreSQL aislado con filas previas, nulabilidad,
longitud, unicidad, aislamiento por empresa y preservación de otras tablas.
Las pruebas HTTP revisan el esquema OpenAPI, los métodos, los límites int4,
campos rechazados y la carga parcial de filas válidas.
