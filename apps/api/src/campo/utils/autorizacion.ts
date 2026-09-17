import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Verifica si el usuarioA es líder directo del usuarioB
 * (basado en la jerarquía de roles)
 */
export async function esLiderDe(
  prisma: PrismaService,
  liderUserId: number,
  subordinadoUserId: number,
): Promise<boolean> {
  const subordinado = await prisma.usuario.findUnique({
    where: { id: subordinadoUserId },
    select: {
      rol: {
        select: {
          rolId: true,
        },
      },
    },
  });

  if (!subordinado?.rol?.rolId) {
    return false;
  }

  const lider = await prisma.usuario.findUnique({
    where: { id: liderUserId },
    select: {
      rolId: true,
    },
  });

  if (!lider?.rolId) {
    return false;
  }

  // El líder debe tener el rol padre del subordinado
  return subordinado.rol.rolId === lider.rolId;
}

/**
 * Obtiene todos los IDs de usuarios que pertenecen al equipo completo del líder
 * (recursivo: incluye subordinados directos e indirectos)
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
    select: {
      id: true,
      rolId: true,
      rol: {
        select: {
          hijos: {
            select: {
              id: true,
              usuarios: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!lider?.rol) {
    return [liderUserId];
  }

  // Obtener subordinados directos (usuarios con roles hijos del rol del líder)
  const subordinadosDirectos = lider.rol.hijos.flatMap((rolHijo) =>
    rolHijo.usuarios.map((u) => u.id),
  );

  // Recursivamente obtener subordinados de subordinados
  const subordinadosIndirectos = await Promise.all(
    subordinadosDirectos
      .filter((id) => !visitados.has(id))
      .map((id) => obtenerEquipoCompleto(prisma, id, visitados)),
  );

  return [
    liderUserId,
    ...subordinadosDirectos,
    ...subordinadosIndirectos.flat(),
  ];
}

/**
 * Obtiene el líder directo de un usuario (basado en jerarquía de roles)
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
      rol: {
        select: {
          padre: {
            select: {
              usuarios: {
                select: {
                  id: true,
                },
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!usuario?.rol?.padre) {
    return null;
  }

  // Retornar el primer usuario activo con el rol padre
  // En una jerarquía bien diseñada, debería haber solo uno por empresa
  const lideres = usuario.rol.padre.usuarios;
  return lideres.length > 0 ? lideres[0].id : null;
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
