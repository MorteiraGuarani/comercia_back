import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  destinatarioCampo,
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
} from './equipo-campo';

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
    },
  });
  if (!visita) throw new NotFoundException('Visita abierta no disponible');
  const destinatario = destinatarioCampo(visita.usuario.rol?.equipoCampo);
  const tarea = await prisma.tareaCampo.findFirst({
    where: {
      id: tareaId,
      empresaId,
      activo: true,
      fechaDesde: { lte: visita.fecha },
      destinatario,
      equipoCampoId: exigirEquipoCampo(visita.usuario.rol?.equipoCampo).id,
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
