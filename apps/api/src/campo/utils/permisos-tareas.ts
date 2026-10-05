import { ForbiddenException } from '@nestjs/common';
import type { AccionTareaCampo } from '../../../generated/prisma/client';

export function permisosCatalogoTareas(permisos: AccionTareaCampo[] = []) {
  return {
    consultar: permisos.includes('CONSULTAR'),
    crear: permisos.includes('CREAR'),
    editar: permisos.includes('EDITAR'),
    archivar: permisos.includes('ARCHIVAR'),
    puedeAdministrar: permisos.some((p) => p !== 'CONSULTAR'),
  };
}

export function exigirAdministracionTareas(
  permisos: AccionTareaCampo[] = [],
  accion: AccionTareaCampo = 'EDITAR',
) {
  if (!permisos.includes(accion)) {
    throw new ForbiddenException(
      'Tu rol no tiene permiso para esta operación de tareas',
    );
  }
}
