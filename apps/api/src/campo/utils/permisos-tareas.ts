import { ForbiddenException } from '@nestjs/common';

export function puedeAdministrarCatalogoTareas(rolDescripcion: string | null) {
  const rol = rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '');
  return rol === 'supervisor' || rol === 'supervisorrepositores';
}

export function exigirAdministracionTareas(rolDescripcion: string | null) {
  if (!puedeAdministrarCatalogoTareas(rolDescripcion)) {
    throw new ForbiddenException(
      'Solo el Supervisor puede administrar el catálogo de tareas',
    );
  }
}
