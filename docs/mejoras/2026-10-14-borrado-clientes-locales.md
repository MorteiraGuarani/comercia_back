# Borrado de clientes y PDV/locales

- Clientes y PDV tienen una acción Eliminar con confirmación en móvil y escritorio.
- Al eliminar un cliente con locales, se puede conservarlos (opción predeterminada) o eliminarlos también. Esta última opción requiere permiso para gestionar locales.
- Los locales conservados quedan con `clienteId = null` dentro de su empresa. Se identifican como «Sin cliente», se pueden filtrar y se pueden asociar a un único cliente desde Editar local.
- El borrado es lógico mediante `eliminadoEn`: los registros dejan el catálogo y la operación diaria, mientras se conservan marcaciones, fotos, horarios y asignaciones históricas.
- Se limpia el local principal de los usuarios de la empresa cuando se elimina ese local.

## API y datos

`DELETE /campo/clientes/:id` acepta `{ "eliminarLocales": false }` (predeterminado) o `true`. `DELETE /campo/locales/:id` elimina solo ese local. Ambos verifican permisos y empresa antes de modificar registros.

La migración `20261014193000_borrado_catalogo_locales_sin_cliente` copia la empresa del cliente a cada local existente, permite un cliente nulo e incorpora una clave foránea compuesta que impide asociar clientes de otra empresa. Las escrituras del catálogo se serializan por empresa para evitar asociaciones concurrentes a un cliente eliminado.

Se debe aplicar esta migración antes de iniciar la API actualizada y publicar la web junto con ella.

## Verificación sin navegador

- Compilaciones de API y web.
- Pruebas Jest de borrado, permisos, DTO y consultas.
- `node apps/api/test/planificacion-migration.integration.mjs`: migración y agendas en PostgreSQL aislado (PGlite).
- `node apps/web/test/eliminacion-catalogo.integration.mjs`: confirmación y estados del diálogo en DOM de Node.
