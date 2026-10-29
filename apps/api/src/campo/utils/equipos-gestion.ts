import type { Prisma } from '../../../generated/prisma/client';
import type { AlcanceGestor } from '../interfaces/alcance-gestor.interface';
import { EQUIPO_CAMPO_SELECT } from './equipo-campo';

/** Lo que hace falta del usuario para saber si es jefatura y qué ve. */
export const SELECT_ALCANCE_GESTOR = {
  equipoGestion: { select: EQUIPO_CAMPO_SELECT },
  rol: {
    select: {
      equipoCampoId: true,
      gestionaTodosEquipos: true,
      equiposGestion: { select: { equipoCampoId: true } },
    },
  },
} as const;

type FilaAlcance = Prisma.UsuarioGetPayload<{
  select: typeof SELECT_ALCANCE_GESTOR;
}>;

/**
 * null si el rol no es de jefatura: trabaja en un equipo propio o no
 * supervisa ninguno. El equipo elegido solo vale si sigue entre los suyos.
 */
export function alcanceDeGestor(fila: FilaAlcance): AlcanceGestor | null {
  const rol = fila.rol;
  if (!rol || rol.equipoCampoId !== null) return null;
  const ids = rol.equiposGestion.map((e) => e.equipoCampoId);
  if (!rol.gestionaTodosEquipos && !ids.length) return null;
  const elegido = fila.equipoGestion;
  const activo =
    elegido?.activo && (rol.gestionaTodosEquipos || ids.includes(elegido.id))
      ? elegido
      : null;
  return { todos: rol.gestionaTodosEquipos, ids, activo };
}

export async function alcanceGestor(
  db: Pick<Prisma.TransactionClient, 'usuario'>,
  usuarioId: number,
): Promise<AlcanceGestor | null> {
  const fila = await db.usuario.findFirst({
    where: { id: usuarioId, isActive: true },
    select: SELECT_ALCANCE_GESTOR,
  });
  return fila ? alcanceDeGestor(fila) : null;
}

/**
 * Personal que ve una jefatura: el del equipo elegido o el de todos sus
 * equipos, dependa o no de ella en el organigrama. Solo equipos activos.
 */
export function filtroPersonalGestor(
  empresaId: number,
  alcance: AlcanceGestor,
): Prisma.UsuarioWhereInput {
  return {
    empresaId,
    isActive: true,
    esSuperadmin: false,
    rol: {
      equipoCampo: { activo: true },
      ...(alcance.activo
        ? { equipoCampoId: alcance.activo.id }
        : alcance.todos
          ? {}
          : { equipoCampoId: { in: alcance.ids } }),
    },
  };
}
