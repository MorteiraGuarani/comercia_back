import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AsignarModuloDto } from './dto/asignacion.dto';
import type { AsignacionEmpresaDto } from './interfaces/asignacion.interface';
import { AuditoriaService } from '../common/auditoria/auditoria.service';

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  // Qué módulos/páginas/roles tiene habilitados una empresa (para pintar el ABM)
  async deEmpresa(empresaId: number): Promise<AsignacionEmpresaDto> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });
    if (!empresa) {
      throw new NotFoundException('La empresa no existe');
    }
    const [modulos, paginas] = await Promise.all([
      this.prisma.empresaModulo.findMany({ where: { empresaId } }),
      this.prisma.empresaPagina.findMany({
        where: { empresaId },
        include: { pagina: { select: { moduloId: true } } },
      }),
    ]);

    return {
      empresaId,
      modulos: modulos.map((m) => ({
        moduloId: m.moduloId,
        todasLasPaginas: m.todasLasPaginas,
        rolIds: m.rolIds,
        paginas: paginas
          .filter((p) => p.pagina.moduloId === m.moduloId)
          .map((p) => ({ paginaId: p.paginaId, rolIds: p.rolIds })),
      })),
    };
  }

  // Habilita (o actualiza) un módulo para una empresa, con páginas y roles
  async asignarModulo(dto: AsignarModuloDto): Promise<AsignacionEmpresaDto> {
    const [empresa, modulo] = await Promise.all([
      this.prisma.empresa.findUnique({
        where: { id: dto.empresaId },
        select: { id: true },
      }),
      this.prisma.modulo.findUnique({
        where: { id: dto.moduloId },
        select: { id: true, nombre: true },
      }),
    ]);
    if (!empresa) {
      throw new NotFoundException('La empresa no existe');
    }
    if (!modulo) {
      throw new NotFoundException('El módulo no existe');
    }

    // Regla anti fail-open: enviar páginas implica restringir. Nunca conceder
    // "todas las páginas" por accidente al omitir el flag con páginas presentes.
    const enviaPaginas = Array.isArray(dto.paginas) && dto.paginas.length > 0;
    if (dto.todasLasPaginas === true && enviaPaginas) {
      throw new BadRequestException(
        'No se pueden enviar paginas cuando todasLasPaginas es true',
      );
    }
    const todasLasPaginas = dto.todasLasPaginas ?? !enviaPaginas;
    const paginas = todasLasPaginas ? [] : (dto.paginas ?? []);
    const rolIdsModulo = dto.rolIds ?? [];

    // Los roles indicados deben existir
    const rolIdsTodos = [
      ...new Set([...rolIdsModulo, ...paginas.flatMap((p) => p.rolIds ?? [])]),
    ];
    if (rolIdsTodos.length > 0) {
      const rolesValidos = await this.prisma.rol.count({
        where: { id: { in: rolIdsTodos }, empresaId: dto.empresaId },
      });
      if (rolesValidos !== rolIdsTodos.length) {
        throw new BadRequestException('Algún rol indicado no existe');
      }
    }

    // Si son páginas específicas, deben pertenecer al módulo
    if (paginas.length > 0) {
      const ids = paginas.map((p) => p.paginaId);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException('Hay páginas repetidas en la lista');
      }
      const validas = await this.prisma.pagina.count({
        where: { id: { in: ids }, moduloId: dto.moduloId },
      });
      if (validas !== ids.length) {
        throw new BadRequestException(
          'Alguna página no pertenece al módulo indicado',
        );
      }
    }

    const delModulo = (a: AsignacionEmpresaDto) =>
      a.modulos.find((m) => m.moduloId === dto.moduloId) ?? null;
    const antes = delModulo(await this.deEmpresa(dto.empresaId));
    await this.prisma.$transaction(async (tx) => {
      await tx.empresaModulo.upsert({
        where: {
          empresaId_moduloId: {
            empresaId: dto.empresaId,
            moduloId: dto.moduloId,
          },
        },
        create: {
          empresaId: dto.empresaId,
          moduloId: dto.moduloId,
          todasLasPaginas,
          rolIds: rolIdsModulo,
        },
        update: { todasLasPaginas, rolIds: rolIdsModulo },
      });

      // Reemplaza las páginas específicas de ese módulo para la empresa
      const paginasDelModulo = await tx.pagina.findMany({
        where: { moduloId: dto.moduloId },
        select: { id: true },
      });
      const idsDelModulo = paginasDelModulo.map((p) => p.id);
      await tx.empresaPagina.deleteMany({
        where: { empresaId: dto.empresaId, paginaId: { in: idsDelModulo } },
      });
      if (paginas.length > 0) {
        await tx.empresaPagina.createMany({
          data: paginas.map((p) => ({
            empresaId: dto.empresaId,
            paginaId: p.paginaId,
            rolIds: p.rolIds ?? [],
          })),
        });
      }
    });

    const resultado = await this.deEmpresa(dto.empresaId);
    await this.auditoria?.registrar({
      accion: antes ? 'MODIFICAR' : 'ASIGNAR',
      entidad: 'Acceso por empresa',
      entidadId: `${dto.empresaId}:${dto.moduloId}`,
      empresaId: dto.empresaId,
      etiqueta: modulo.nombre,
      antes,
      despues: delModulo(resultado),
    });
    return resultado;
  }

  // Quita un módulo de una empresa (y sus páginas específicas)
  async quitarModulo(
    empresaId: number,
    moduloId: number,
  ): Promise<AsignacionEmpresaDto> {
    const existe = await this.prisma.empresaModulo.findUnique({
      where: { empresaId_moduloId: { empresaId, moduloId } },
      include: { modulo: { select: { nombre: true } } },
    });
    if (!existe) {
      throw new NotFoundException('La empresa no tiene ese módulo habilitado');
    }
    const paginasDelModulo = await this.prisma.pagina.findMany({
      where: { moduloId },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.empresaPagina.deleteMany({
        where: {
          empresaId,
          paginaId: { in: paginasDelModulo.map((p) => p.id) },
        },
      }),
      this.prisma.empresaModulo.delete({
        where: { empresaId_moduloId: { empresaId, moduloId } },
      }),
    ]);
    await this.auditoria?.registrar({
      accion: 'QUITAR',
      entidad: 'Acceso por empresa',
      entidadId: `${empresaId}:${moduloId}`,
      empresaId,
      etiqueta: existe.modulo.nombre,
      antes: {
        moduloId,
        todasLasPaginas: existe.todasLasPaginas,
        rolIds: existe.rolIds,
      },
    });
    return this.deEmpresa(empresaId);
  }
}
