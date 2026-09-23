import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Comprueba la cadena real de superiores, dentro de una misma empresa. */
export async function esLiderDe(
  prisma: PrismaService,
  liderUserId: number,
  subordinadoUserId: number,
): Promise<boolean> {
  if (liderUserId === subordinadoUserId) return false;
  return (await obtenerEquipoCompleto(prisma, liderUserId)).includes(subordinadoUserId);
}

/**
 * Incluye al líder y sus subordinados activos, directos e indirectos.
 */
export async function obtenerEquipoCompleto(
  prisma: PrismaService,
  liderUserId: number,
  visitados = new Set<number>(),
): Promise<number[]> {
  if (visitados.has(liderUserId)) {
    return [];
  }
  visitados.add(liderUserId);

  const lider = await prisma.usuario.findUnique({
    where: { id: liderUserId },
    select: { id: true, empresaId: true, isActive: true },
  });
  if (!lider?.isActive) return [];
  const ids = [lider.id];
  // La consulta incluye empresa y estado en cada nivel; un rol compartido nunca
  // concede acceso a los subordinados de otro líder.
  let frontera = [lider.id];
  while (frontera.length) {
    const siguientes = await prisma.usuario.findMany({
      where: {
        superiorId: { in: frontera },
        empresaId: lider.empresaId,
        isActive: true,
        esSuperadmin: false,
      },
      select: { id: true },
      take: 10000,
    });
    frontera = siguientes.map((u) => u.id).filter((id) => !visitados.has(id));
    for (const id of frontera) visitados.add(id);
    ids.push(...frontera);
  }
  return ids;
}

/**
 * Obtiene el superior asignado explícitamente al usuario.
 * Retorna null si no tiene líder
 */
export async function obtenerLiderDirecto(
  prisma: PrismaService,
  usuarioId: number,
): Promise<number | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      empresaId: true,
      superiorId: true,
    },
  });

  if (!usuario?.superiorId) return null;
  const superior = await prisma.usuario.findFirst({
    where: {
      id: usuario.superiorId,
      empresaId: usuario.empresaId,
      isActive: true,
    },
    select: { id: true },
  });
  return superior?.id ?? null;
}

/**
 * Verifica si un usuario es dueño de una visita o es líder del dueño
 * Lanza ForbiddenException si no tiene acceso
 */
export async function verificarAccesoVisita(
  prisma: PrismaService,
  usuarioId: number,
  visitaId: number,
): Promise<void> {
  const visita = await prisma.visitaCampo.findUnique({
    where: { id: visitaId },
    select: {
      usuarioId: true,
    },
  });

  if (!visita) {
    throw new ForbiddenException('Visita no encontrada');
  }

  // Si es el dueño, tiene acceso
  if (visita.usuarioId === usuarioId) {
    return;
  }

  // Si no es el dueño, verificar si es líder
  const esLider = await esLiderDe(prisma, usuarioId, visita.usuarioId);

  if (!esLider) {
    throw new ForbiddenException('No tienes acceso a esta visita');
  }
}

/**
 * Verifica si un usuario es dueño de un cumplimiento o es líder del dueño
 * Lanza ForbiddenException si no tiene acceso
 */
export async function verificarAccesoCumplimiento(
  prisma: PrismaService,
  usuarioId: number,
  visitaId: number,
  tareaId: number,
): Promise<void> {
  const cumplimiento = await prisma.cumplimientoCampo.findUnique({
    where: {
      visitaId_tareaId: {
        visitaId,
        tareaId,
      },
    },
    select: {
      visita: {
        select: {
          usuarioId: true,
        },
      },
    },
  });

  if (!cumplimiento) {
    // Todavía puede no haber evidencias: abrir el panel no completa la tarea.
    const visita = await prisma.visitaCampo.findUnique({
      where: { id: visitaId },
      select: { usuarioId: true, localId: true, fecha: true, local: { select: { cliente: { select: { empresaId: true } } } } },
    });
    if (!visita || (visita.usuarioId !== usuarioId && !(await esLiderDe(prisma, usuarioId, visita.usuarioId)))) {
      throw new ForbiddenException('Tarea no disponible');
    }
    const tarea = await prisma.tareaCampo.findFirst({
      where: {
        id: tareaId, empresaId: visita.local.cliente.empresaId,
        fechaDesde: { lte: visita.fecha },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: visita.fecha } }] },
          { OR: [{ todosLocales: true }, { locales: { some: { localId: visita.localId } } }] },
        ],
      },
      select: { id: true },
    });
    if (!tarea) throw new ForbiddenException('Tarea no disponible');
    return;
  }

  // Si es el dueño, tiene acceso
  if (cumplimiento.visita.usuarioId === usuarioId) {
    return;
  }

  // Si no es el dueño, verificar si es líder
  const esLider = await esLiderDe(
    prisma,
    usuarioId,
    cumplimiento.visita.usuarioId,
  );

  if (!esLider) {
    throw new ForbiddenException('No tienes acceso a este cumplimiento');
  }
}
