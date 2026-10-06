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

El despliegue y sus comprobaciones se registran al finalizar la publicación.
