import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';
import {
  destinatarioCampo,
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
} from './equipo-campo';

/** Cliente de Prisma o transacción: solo se necesita consultar usuarios. */
type ConsultaUsuarios = Pick<Prisma.TransactionClient, 'usuario'>;

/**
 * Baja por la cadena de superiores nivel por nivel (supervisor → TeamLeader →
 * impulsador) sin repetir usuarios aunque haya un ciclo en los datos.
 */
async function subordinadosEnCadena(
  db: ConsultaUsuarios,
  liderId: number,
  filtro: Prisma.UsuarioWhereInput,
): Promise<number[]> {
  const visitados = new Set([liderId]);
  const ids: number[] = [];
  let frontera = [liderId];
  while (frontera.length) {
    const siguientes = await db.usuario.findMany({
      where: { ...filtro, superiorId: { in: frontera } },
      select: { id: true },
      take: 10000,
    });
    frontera = siguientes.map((u) => u.id).filter((id) => !visitados.has(id));
    for (const id of frontera) visitados.add(id);
    ids.push(...frontera);
  }
  return ids;
}

/** Comprueba la cadena real de superiores, dentro de una misma empresa. */
export async function esLiderDe(
  prisma: PrismaService,
  liderUserId: number,
  subordinadoUserId: number,
): Promise<boolean> {
  if (liderUserId === subordinadoUserId) return false;
  return (await obtenerEquipoCompleto(prisma, liderUserId)).includes(
    subordinadoUserId,
  );
}

/**
 * Incluye al líder y sus subordinados activos, directos e indirectos.
 */
export async function obtenerEquipoCompleto(
  prisma: ConsultaUsuarios,
  liderUserId: number,
): Promise<number[]> {
  const lider = await prisma.usuario.findUnique({
    where: { id: liderUserId },
    select: {
      id: true,
      empresaId: true,
      isActive: true,
      rol: { select: { equipoCampoId: true } },
    },
  });
  if (!lider?.isActive || !lider.rol?.equipoCampoId) return [];
  // La consulta incluye empresa y estado en cada nivel; un rol compartido nunca
  // concede acceso a los subordinados de otro líder.
  const subordinados = await subordinadosEnCadena(prisma, lider.id, {
    empresaId: lider.empresaId,
    isActive: true,
    esSuperadmin: false,
    rol: { equipoCampoId: lider.rol.equipoCampoId },
  });
  return [lider.id, ...subordinados];
}

/**
 * Colaboradores que gestiona el usuario, sin incluirlo. En equipos de
 * impulsadores abarca toda la cadena (supervisor → TeamLeaders → sus
 * impulsadores); en repositores, solo los reportes directos.
 */
export async function obtenerColaboradoresGestionados(
  prisma: ConsultaUsuarios,
  lider: { id: number; empresaId: number; equipoCampo?: EquipoCampoDto | null },
): Promise<number[]> {
  const equipo = exigirEquipoCampo(lider.equipoCampo);
  if (equipo.tipo !== 'REPOSITOR')
    return (await obtenerEquipoCompleto(prisma, lider.id)).filter(
      (id) => id !== lider.id,
    );
  const directos = await prisma.usuario.findMany({
    where: {
      empresaId: lider.empresaId,
      superiorId: lider.id,
      isActive: true,
      esSuperadmin: false,
      rol: { equipoCampoId: equipo.id },
    },
    select: { id: true },
    take: 10000,
  });
  return directos.map((u) => u.id);
}

/**
 * Subordinados activos, directos e indirectos, sin exigir equipo operativo:
 * los avisos los puede enviar cualquier líder a toda su cadena.
 */
export function obtenerSubordinadosActivos(
  db: ConsultaUsuarios,
  liderId: number,
  empresaId: number,
): Promise<number[]> {
  return subordinadosEnCadena(db, liderId, {
    empresaId,
    isActive: true,
    esSuperadmin: false,
  });
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
      rol: { select: { equipoCampoId: true } },
    },
  });

  if (!usuario?.superiorId || !usuario.rol?.equipoCampoId) return null;
  const superior = await prisma.usuario.findFirst({
    where: {
      id: usuario.superiorId,
      rol: { equipoCampoId: usuario.rol.equipoCampoId },
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
      select: {
        usuarioId: true,
        usuario: {
          select: {
            rol: {
              select: {
                descripcion: true,
                equipoCampo: { select: EQUIPO_CAMPO_SELECT },
              },
            },
          },
        },
        localId: true,
        fecha: true,
        local: { select: { empresaId: true } },
      },
    });
    if (
      !visita ||
      (visita.usuarioId !== usuarioId &&
        !(await esLiderDe(prisma, usuarioId, visita.usuarioId)))
    ) {
      throw new ForbiddenException('Tarea no disponible');
    }
    const tarea = await prisma.tareaCampo.findFirst({
      where: {
        id: tareaId,
        empresaId: visita.local.empresaId,
        destinatario: destinatarioCampo(visita.usuario.rol?.equipoCampo),
        equipoCampoId: exigirEquipoCampo(visita.usuario.rol?.equipoCampo).id,
        fechaDesde: { lte: visita.fecha },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: visita.fecha } }] },
          {
            OR: [
              { todosLocales: true },
              { locales: { some: { localId: visita.localId } } },
            ],
          },
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
