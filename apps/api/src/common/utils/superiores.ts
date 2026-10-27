import type { Prisma } from '../../../generated/prisma/client';

/** Toda la cadena del organigrama, sin exigir un rol/equipo operativo. */
export async function obtenerSuperioresActivos(
  db: Pick<Prisma.TransactionClient, 'usuario'>,
  empresaId: number,
  usuariosId: number[],
): Promise<number[]> {
  const raices = new Set(usuariosId);
  const visitados = new Set<number>();
  const superiores = new Set<number>();
  let frontera = [...raices];
  while (frontera.length) {
    const personas = await db.usuario.findMany({
      where: { empresaId, id: { in: frontera } },
      select: { id: true, superiorId: true, isActive: true },
      take: frontera.length,
    });
    frontera = [];
    for (const persona of personas) {
      visitados.add(persona.id);
      if (persona.isActive && !raices.has(persona.id))
        superiores.add(persona.id);
    }
    for (const persona of personas) {
      if (persona.superiorId && !visitados.has(persona.superiorId))
        frontera.push(persona.superiorId);
    }
    frontera = [...new Set(frontera)];
  }
  return [...superiores];
}
