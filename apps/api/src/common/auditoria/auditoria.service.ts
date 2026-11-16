import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../utils/paginacion';
import { cambiosAuditoria } from '../utils/auditoria';
import type { ListarAuditoriaDto } from '../dto/listar-auditoria.dto';
import type {
  CambiosAuditoria,
  EntradaAuditoria,
  RegistroAuditoriaDto,
} from '../interfaces/auditoria.interface';
import { actorAuditoria } from './auditoria.interceptor';

/** Log de altas, cambios y bajas del backoffice. Guardarlo nunca corta la operación. */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Llamarlo después de la mutación; quién la hizo sale del pedido en curso. */
  async registrar(entrada: EntradaAuditoria): Promise<void> {
    try {
      const cambios = cambiosAuditoria(entrada.antes, entrada.despues);
      // Guardar sin cambiar nada no deja rastro.
      if (entrada.accion === 'MODIFICAR' && !Object.keys(cambios).length)
        return;
      const usuarioId = actorAuditoria.getStore()?.usuarioId ?? null;
      const actor = usuarioId
        ? await this.prisma.usuario.findUnique({
            where: { id: usuarioId },
            select: {
              nombre: true,
              apellido: true,
              esSuperadmin: true,
              rol: { select: { descripcion: true } },
            },
          })
        : null;
      await this.prisma.registroAuditoria.create({
        data: {
          usuarioId,
          usuarioNombre: actor
            ? `${actor.nombre} ${actor.apellido}`.trim().slice(0, 200)
            : null,
          usuarioRol: actor?.esSuperadmin
            ? 'Superadmin'
            : (actor?.rol?.descripcion.slice(0, 120) ?? null),
          accion: entrada.accion,
          entidad: entrada.entidad,
          entidadId: String(entrada.entidadId).slice(0, 80),
          etiqueta: entrada.etiqueta?.slice(0, 200) ?? null,
          empresaId: entrada.empresaId ?? null,
          cambios: cambios as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    } catch (e) {
      this.logger.error(
        `No se pudo guardar la auditoría de ${entrada.entidad} ${String(entrada.entidadId)}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Solo superadmin y Admin TI; del más reciente al más antiguo. */
  async listar(usuarioId: number, q: ListarAuditoriaDto) {
    const yo = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        isActive: true,
        esSuperadmin: true,
        rol: { select: { esAdminTi: true } },
      },
    });
    if (!yo?.isActive || !(yo.esSuperadmin || yo.rol?.esAdminTi))
      throw new ForbiddenException('Sin acceso al log de auditoría');

    const usuario = q.usuario?.trim();
    const where: Prisma.RegistroAuditoriaWhereInput = {
      ...(q.desde || q.hasta
        ? {
            creadoEn: {
              ...(q.desde ? { gte: new Date(q.desde) } : {}),
              ...(q.hasta ? { lt: new Date(q.hasta) } : {}),
            },
          }
        : {}),
      ...(usuario
        ? { usuarioNombre: { contains: usuario, mode: 'insensitive' } }
        : {}),
      ...(q.entidad ? { entidad: q.entidad } : {}),
      ...(q.accion ? { accion: q.accion } : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(q);
    const [total, filas] = await Promise.all([
      this.prisma.registroAuditoria.count({ where }),
      this.prisma.registroAuditoria.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
    ]);
    const ids = [...new Set(filas.flatMap((f) => f.empresaId ?? []))];
    const empresas = ids.length
      ? await this.prisma.empresa.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true },
          take: ids.length,
        })
      : [];
    const nombres = new Map(empresas.map((e) => [e.id, e.nombre]));
    return respuestaPaginada<RegistroAuditoriaDto>(
      filas.map((f) => ({
        id: f.id,
        creadoEn: f.creadoEn.toISOString(),
        usuarioId: f.usuarioId,
        usuarioNombre: f.usuarioNombre,
        usuarioRol: f.usuarioRol,
        accion: f.accion,
        entidad: f.entidad,
        entidadId: f.entidadId,
        etiqueta: f.etiqueta,
        empresaId: f.empresaId,
        empresaNombre:
          f.empresaId === null ? null : (nombres.get(f.empresaId) ?? null),
        cambios: f.cambios as CambiosAuditoria,
      })),
      total,
      page,
      limit,
    );
  }
}
