import type {
  RolAdminDto,
  RolAdminFila,
} from '../interfaces/rol-admin.interface';

export function aRolAdminDto(rol: RolAdminFila): RolAdminDto {
  return {
    id: rol.id,
    descripcion: rol.descripcion,
    empresa: rol.empresa,
    padre: rol.padre,
    usuariosCount: rol._count.usuarios,
    hijosCount: rol._count.hijos,
    equipoCampo: rol.equipoCampo
      ? {
          id: rol.equipoCampo.id,
          nombre: rol.equipoCampo.nombre,
          tipo: rol.equipoCampo.tipo,
          activo: rol.equipoCampo.activo,
        }
      : null,
  };
}
