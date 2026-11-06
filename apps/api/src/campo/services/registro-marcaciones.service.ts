import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';
import type { ConsultaRegistroMarcacionesDto } from '../dto/campo.dto';

/** Registro de cada pedido de marca de campo. Guardarlo nunca corta la marca. */
@Injectable()
export class RegistroMarcacionesService {
  private readonly logger = new Logger(RegistroMarcacionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Guarda la fila con quién marcó (nombre, correo, login y empresa de ese momento). */
  async registrar(fila: Prisma.RegistroMarcacionCampoCreateInput) {
    try {
      const u = fila.usuarioId
        ? await this.prisma.usuario.findUnique({
            where: { id: fila.usuarioId },
            select: {
              nombre: true,
              apellido: true,
              correo: true,
              nombreLogin: true,
              empresaId: true,
              empresa: { select: { nombre: true } },
            },
          })
        : null;
      const data = {
        ...fila,
        usuarioNombre: u ? `${u.nombre} ${u.apellido}`.trim() : undefined,
        usuarioCorreo: u?.correo,
        usuarioLogin: u?.nombreLogin,
        empresaId: u?.empresaId,
        empresaNombre: u?.empresa?.nombre,
      };
      if (data.resultado !== 'ACEPTADA')
        this.logger.warn(
          `Marca ${data.resultado}: ${data.ruta}, ${data.usuarioNombre ?? `usuario ${data.usuarioId ?? '?'}`}, ${data.estadoHttp}: ${data.motivo}`,
        );
      await this.prisma.registroMarcacionCampo.create({
        data,
        select: { id: true },
      });
    } catch (e) {
      this.logger.error(
        `No se pudo guardar el registro de la marca: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Superadmin: de la más reciente a la más antigua. */
  async listar(q: ConsultaRegistroMarcacionesDto) {
    const { skip, take, page, limit } = rangoPaginacion(q);
    const where = q.resultado ? { resultado: q.resultado } : {};
    const [total, filas] = await Promise.all([
      this.prisma.registroMarcacionCampo.count({ where }),
      this.prisma.registroMarcacionCampo.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(filas, total, page, limit);
  }
}
