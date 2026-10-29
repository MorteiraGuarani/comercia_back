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
    permisosTareas: rol.permisosTareas ?? [],
    puedeVerSeguimiento: rol.puedeVerSeguimiento ?? false,
    gestionaTodosEquipos: rol.gestionaTodosEquipos ?? false,
    equiposGestion: (rol.equiposGestion ?? []).map(({ equipoCampo: e }) => ({
      id: e.id,
      nombre: e.nombre,
      tipo: e.tipo,
      activo: e.activo,
    })),
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
