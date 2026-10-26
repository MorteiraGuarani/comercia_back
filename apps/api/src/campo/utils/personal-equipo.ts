import type { Prisma } from '../../../generated/prisma/client';
import type { GestorEquipoCampo } from '../interfaces/gestor-equipo.interface';
import { exigirEquipoCampo } from './equipo-campo';

/** Alcance del personal en los ABM autorizados; no modifica las jefaturas. */
export function filtroPersonalEquipoOperativo(
  gestor: GestorEquipoCampo,
): Prisma.UsuarioWhereInput {
  const equipo = exigirEquipoCampo(gestor.equipoCampo);
  return {
    empresaId: gestor.empresaId,
    id: { not: gestor.id },
    isActive: true,
    esSuperadmin: false,
    rol: { equipoCampoId: equipo.id },
  };
}
