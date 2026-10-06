# Asignación de superiores según el organigrama

## Problema corregido

El formulario de usuarios llenaba Superior con los usuarios de la página del listado que estaba abierta. La lista incluía otros roles y omitía a los responsables que estaban en otra página. La base ya tenía configurada la jerarquía de impulsadores y repositores; el defecto estaba en el origen de las opciones del formulario.

## Funcionamiento

- Superior inmediato utiliza el selector compartido con búsqueda remota y paginación. Consulta toda la empresa autorizada, no solo la página visible del ABM.
- La API resuelve el rol padre desde `Rol.rolId`. No hay IDs o nombres de roles codificados en la lógica. Los roles nuevos siguen el mismo comportamiento al configurar su padre en el organigrama.
- Impulsador recibe candidatos TeamLeader; TeamLeader recibe su Supervisor; Repositor recibe Supervisor de repositores, de acuerdo con la configuración de cada empresa.
- Solo se ofrecen personas activas de la misma empresa, con ese rol inmediato. Se excluyen superadministradores y el usuario editado.
- Al cambiar el rol del usuario, se limpia el superior anterior. El ID y nombre seleccionado se mantienen al buscar o cambiar de página. Quitar superior permite dejar la asignación vacía.
- Los roles raíz no tienen candidatos. Se mantiene la posibilidad de guardar un usuario sin superior para completar su asignación después.
- No se duplican ni se crean roles, usuarios o locales. La revisión de producción confirmó las dos ramas y la existencia del TeamLeader de la empresa 2.

## API y validación

- `GET /api/v1/usuarios/superiores`: sesión activa y permiso de administración de usuarios, verificado en el servicio.
- `GET /api/v1/admin/usuarios/superiores`: además exige superadministrador.
- Parámetros: `rolId` obligatorio; `empresaId`, `excluirUsuarioId`, `buscar`, `page` y `limit` opcionales. Se conserva la paginación de 7 registros, máximo 50.
- Buscar combina nombre y apellido, usuario o correo mediante el helper existente. La respuesta contiene solo `{ id, nombre }` por candidato y los datos de paginación; no devuelve correos, documentos, celulares ni contraseñas.
- Un administrador no puede consultar otra empresa. Incluso un superadmin debe seleccionar un rol perteneciente a la empresa consultada.
- Crear/editar valida nuevamente el superior: empresa, estado activo, cuenta no superadmin, rol padre inmediato y protección contra autoasignación/ciclos. Un rol raíz no puede recibir un superior arbitrario por API.
- Sin cambios de esquema ni migraciones nuevas.

## Verificación

- 27 pruebas API aprobadas: usuarios existentes, filtros, búsqueda, paginación, rol futuro con IDs arbitrarios, raíz sin candidatos, permisos, cuentas inactivas, aislamiento de empresa y validaciones al guardar.
- Pruebas HTTP de ambos endpoints con guards reales y base simulada: sesión obligatoria, DTO válido, rol ajeno, acceso no autorizado y ABM superadmin.
- Compilaciones de API y web, lint puntual y actualización AST de Graphify. Revisión de código sin abrir navegador, según preferencia del usuario.
- El selector conserva las opciones de teclado, paginación, cancelación de peticiones y descarte de respuestas obsoletas del componente compartido. La revisión visual manual sigue pendiente.

## Producción

Commit funcional publicado: `01d68b1ab39b85a02e2c4195d7314dcdaf1078b3`. El workflow [37510728539](https://github.com/MorteiraGuarani/comercia_back/actions/runs/37510728539) pasó lint, la suite completa de API, pendientes sin navegador, agendas/migraciones en PostgreSQL aislado y las compilaciones/publicación de ambas imágenes. Se activó mediante `workflow_dispatch`, porque este push no inició una ejecución automática.

- API y web saludables. Los digests en ejecución coinciden con las imágenes publicadas para el commit: API `sha256:23550d94c48b9902e19060628aba856bca7a9ed1f36d4b0a26811f8a6ffa0ddb`, web `sha256:9a07903400a2b91c02418489a481a6b40ba1cb5a4911110f05bf379ec7304f93`.
- El proceso habitual descargó las imágenes nuevas. Se comprobó su aplicación con Docker Compose, que finalizó con ambas aplicaciones saludables y el servicio de migración terminado. El HTML del login contiene el identificador completo del despliegue.
- Consultas HTTP autenticadas sobre los datos reales de Frigorífico Guaraní: Impulsador ofrece un TeamLeader; TeamLeader ofrece un Supervisor; Repositor ofrece un Supervisor de repositores. Los dos roles Supervisor raíz no ofrecen candidatos.
- Los IDs y totales del selector coinciden con las consultas de empresa/rol padre. Búsqueda por nombre y apellido, exclusión del candidato y DTO mínimo comprobados en producción. No se modificaron usuarios ni asignaciones durante las pruebas.
- Sin sesión: HTTP 401. Impulsador intentando administrar candidatos: 403 en ambos endpoints. Rol de otra empresa: 404. Falta de rol y tamaño de página mayor a 50: 400.
- Base de Comercia: **48 migraciones terminadas y ninguna pendiente**. Esta entrega no agrega migraciones ni modifica Ucheck.
- Respaldo de base y archivos verificado con gzip, tar y checksum: `/opt/comercia/backups/comercia-20261007-022942.{sql.gz,uploads.tar.gz,sha256}`. El nombre utiliza el reloj del servidor.
- Login público y health público devolvieron HTTP 200 desde el servidor. La consulta con Python desde esta PC recibió 403 del acceso público; las verificaciones autenticadas se realizaron contra la API dentro del servidor. No se usó navegador.
