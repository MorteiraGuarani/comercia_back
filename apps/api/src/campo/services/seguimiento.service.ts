import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampoAccesoService } from '../campo-acceso.service';
import { ConsultaCampoDto } from '../dto/campo.dto';
import { obtenerEquipoCompleto } from '../utils/autorizacion';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';

@Injectable()
export class SeguimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  async equipo(usuarioId: number, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'seguimiento');
    if (!u.puedeVerSeguimiento)
      throw new ForbiddenException(
        'Tu rol no tiene acceso al seguimiento de colaboradores',
      );
    const ids = (await obtenerEquipoCompleto(this.prisma, usuarioId)).filter(
      (id) => id !== usuarioId,
    );
    const where = {
      id: { in: ids },
      empresaId: u.empresaId,
      isActive: true,
      ...(query.buscar
        ? {
            OR: [
              {
                nombre: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
              {
                apellido: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const reciente = new Date(Date.now() - 60000);
    const [
      total,
      trabajadores,
      actualizados,
      visitasAbiertas,
      operacionesPendientes,
    ] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        skip,
        take,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          nombre: true,
          apellido: true,
          rol: { select: { descripcion: true, equipoCampoId: true } },
          identidadUcheck: { select: { ucheckUsuarioId: true } },
          seguimientoCampo: {
            select: {
              activo: true,
              latitud: true,
              longitud: true,
              capturadaEn: true,
              recibidaEn: true,
              precisionMetros: true,
            },
          },
          visitasCampo: {
            where: { salida: null },
            take: 1,
            orderBy: { entrada: 'desc' },
            select: {
              id: true,
              fecha: true,
              entrada: true,
              local: {
                select: {
                  id: true,
                  nombre: true,
                  latitud: true,
                  longitud: true,
                },
              },
              _count: {
                select: {
                  cumplimientos: { where: { completadaAt: { not: null } } },
                },
              },
              cumplimientos: {
                take: 1,
                orderBy: { actividadEn: 'desc' },
                select: {
                  tareaId: true,
                  nombreTarea: true,
                  completadaAt: true,
                  iniciadaAt: true,
                  actividadEn: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.seguimientoCampo.count({
        where: {
          usuarioId: { in: ids },
          activo: true,
          capturadaEn: { gte: reciente },
          recibidaEn: { gte: reciente },
        },
      }),
      this.prisma.visitaCampo.count({
        where: { usuarioId: { in: ids }, salida: null },
      }),
      this.prisma.operacionCampo.count({
        where: { usuarioId: { in: ids }, estado: 'PENDIENTE' },
      }),
    ]);
    const items = await Promise.all(
      trabajadores.map(async (persona) => {
        const s = persona.seguimientoCampo;
        const edad = s?.capturadaEn
          ? Math.max(
              0,
              Math.floor((Date.now() - s.capturadaEn.getTime()) / 1000),
            )
          : null;
        const estado = !s
          ? 'SIN_DATOS'
          : !s.activo
            ? 'FINALIZADO'
            : edad !== null && edad <= 60 && s.recibidaEn >= reciente
              ? 'ACTUALIZADO'
              : 'DESACTUALIZADO';
        const visita = persona.visitasCampo[0];
        const totalTareas =
          visita && persona.rol?.equipoCampoId
            ? await this.prisma.tareaCampo.count({
                where: {
                  empresaId: u.empresaId,
                  equipoCampoId: persona.rol.equipoCampoId,
                  OR: [
                    {
                      activo: true,
                      fechaDesde: { lte: visita.fecha },
                      AND: [
                        {
                          OR: [
                            { fechaHasta: null },
                            { fechaHasta: { gte: visita.fecha } },
                          ],
                        },
                        {
                          OR: [
                            { todosLocales: true },
                            { locales: { some: { localId: visita.local.id } } },
                          ],
                        },
                      ],
                    },
                    { cumplimientos: { some: { visitaId: visita.id } } },
                  ],
                },
              })
            : 0;
        const actividad = visita?.cumplimientos[0];
        return {
          id: persona.id,
          nombre: `${persona.nombre} ${persona.apellido}`.trim(),
          rol: persona.rol?.descripcion ?? 'Sin rol',
          vinculada: !!persona.identidadUcheck,
          telefono: {
            estado,
            antiguedadSegundos: edad,
            capturadaEn: s?.capturadaEn ?? null,
            precisionMetros: s?.precisionMetros ?? null,
            latitud: s?.activo ? s.latitud : null,
            longitud: s?.activo ? s.longitud : null,
          },
          visita: visita
            ? {
                id: visita.id,
                entrada: visita.entrada,
                local: visita.local,
                completadas: visita._count.cumplimientos,
                totalTareas,
                actividad: actividad
                  ? {
                      tareaId: actividad.tareaId,
                      nombre: actividad.nombreTarea,
                      estado: actividad.completadaAt
                        ? 'COMPLETADA'
                        : actividad.iniciadaAt
                          ? 'INICIADA'
                          : 'EVIDENCIAS',
                      fecha: actividad.actividadEn,
                    }
                  : null,
              }
            : null,
        };
      }),
    );
    return {
      ...respuestaPaginada(items, total, page, limit),
      actualizadaEn: new Date().toISOString(),
      resumen: {
        colaboradores: ids.length,
        ubicacionesRecientes: actualizados,
        sinUbicacionReciente: ids.length - actualizados,
        visitasAbiertas,
        operacionesPendientes,
      },
    };
  }
}
