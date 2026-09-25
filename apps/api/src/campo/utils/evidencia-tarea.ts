import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { DestinatarioTareaCampo } from '../../../generated/prisma/client';

// Valida la misma visita, empresa, vigencia y alcance que completar una tarea.
export async function tareaParaEvidencia(
  prisma: PrismaService,
  usuarioId: number,
  empresaId: number,
  visitaId: number,
  tareaId: number,
) {
  const visita = await prisma.visitaCampo.findFirst({
    where: {
      id: visitaId,
      usuarioId,
      salida: null,
      local: { cliente: { empresaId } },
    },
    select: {
      localId: true,
      fecha: true,
      usuario: { select: { rol: { select: { descripcion: true } } } },
    },
  });
  if (!visita) throw new NotFoundException('Visita abierta no disponible');
  const destinatario =
    visita.usuario.rol?.descripcion === 'REPOSITOR'
      ? DestinatarioTareaCampo.REPOSITOR
      : DestinatarioTareaCampo.IMPULSADOR;
  const tarea = await prisma.tareaCampo.findFirst({
    where: {
      id: tareaId,
      empresaId,
      activo: true,
      fechaDesde: { lte: visita.fecha },
      destinatario: { in: [destinatario, DestinatarioTareaCampo.AMBOS] },
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
    select: { id: true, nombre: true, requiereFotos: true },
  });
  if (!tarea) throw new NotFoundException('Tarea no disponible');
  return tarea;
}

export async function prepararEvidencia(
  prisma: PrismaService,
  visitaId: number,
  tareaId: number,
  nombreTarea: string,
) {
  return prisma.cumplimientoCampo.upsert({
    where: { visitaId_tareaId: { visitaId, tareaId } },
    create: {
      visitaId,
      tareaId,
      nombreTarea,
      completadaAt: null,
      fotosValidadas: false,
    },
    update: {},
    select: { tareaId: true },
  });
}
