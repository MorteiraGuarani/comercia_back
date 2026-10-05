import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  rangoPaginacion,
  respuestaPaginada,
  type RespuestaPaginada,
} from '../common/utils/paginacion';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarRolDto,
  CrearRolDto,
  ListarRolesDto,
  ListarEquiposCampoDto,
  PlanificacionRolDto,
} from './dto/rol.dto';
import type { RolAdminDto } from './interfaces/rol-admin.interface';
import type { Prisma } from '../../generated/prisma/client';
import { EQUIPO_CAMPO_SELECT } from '../campo/utils/equipo-campo';

const SELECT_ROL_ADMIN = {
  id: true,
  empresa: { select: { id: true, nombre: true } },
  descripcion: true,
  padre: { select: { id: true, descripcion: true } },
  _count: { select: { usuarios: true, hijos: true } },
  equipoCampo: { select: EQUIPO_CAMPO_SELECT },
} as const;

import { aRolAdminDto } from './utils/rol-admin';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  private async autorizar(usuarioId: number): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { esSuperadmin: true, isActive: true },
    });
    if (!usuario?.isActive || !usuario.esSuperadmin) {
      throw new ForbiddenException('Requiere permisos de superadministrador');
    }
  }

  async listar(
    usuarioId: number,
    query: ListarRolesDto,
  ): Promise<RespuestaPaginada<RolAdminDto>> {
    await this.autorizar(usuarioId);
    const where = { empresaId: query.empresaId };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, roles] = await Promise.all([
      this.prisma.rol.count({ where }),
      this.prisma.rol.findMany({
        where,
        select: SELECT_ROL_ADMIN,
        orderBy: [{ descripcion: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(roles.map(aRolAdminDto), total, page, limit);
  }

  async equipos(usuarioId: number, query: ListarEquiposCampoDto) {
    await this.autorizar(usuarioId);
    const where = {
      empresaId: query.empresaId,
      activo: true,
      ...(query.buscar?.trim()
        ? {
            nombre: {
              contains: query.buscar.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.equipoCampo.count({ where }),
      this.prisma.equipoCampo.findMany({
        where,
        select: EQUIPO_CAMPO_SELECT,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  private async resolverEquipo(
    tx: Prisma.TransactionClient,
    empresaId: number,
    dto: PlanificacionRolDto,
    actual: number | null = null,
  ) {
    if (dto.nuevoEquipoNombre) {
      if (dto.equipoCampoId || !dto.nuevoEquipoTipo)
        throw new BadRequestException(
          'Elegí un equipo existente o el nombre y tipo del nuevo equipo',
        );
      const nombre = dto.nuevoEquipoNombre.trim().replace(/\s+/g, ' ');
      const repetido = await tx.equipoCampo.findFirst({
        where: { empresaId, nombre: { equals: nombre, mode: 'insensitive' } },
        select: { id: true },
      });
      if (repetido)
        throw new ConflictException(
          'El equipo ya existe; seleccioná el equipo existente',
        );
      const equipo = await tx.equipoCampo.create({
        data: { empresaId, nombre, tipo: dto.nuevoEquipoTipo },
        select: { id: true },
      });
      return equipo.id;
    }
    if (dto.nuevoEquipoTipo)
      throw new BadRequestException('Ingresá el nombre del equipo nuevo');
    if (dto.equipoCampoId === undefined) return actual;
    if (dto.equipoCampoId === null) return null;
    const equipo = await tx.equipoCampo.findFirst({
      where: { id: dto.equipoCampoId, empresaId, activo: true },
      select: { id: true },
    });
    if (!equipo)
      throw new BadRequestException(
        'Equipo operativo no disponible para esta empresa',
      );
    return equipo.id;
  }

  private async validarPadre(
    empresaId: number,
    rolId: number | null | undefined,
    rolActualId?: number,
  ): Promise<void> {
    const visitados = new Set<number>();
    if (rolActualId !== undefined) visitados.add(rolActualId);
    let siguiente = rolId;
    while (siguiente != null) {
      if (visitados.has(siguiente)) {
        throw new BadRequestException(
          'La jerarquía de roles formaría un ciclo',
        );
      }
      visitados.add(siguiente);
      const padre = await this.prisma.rol.findUnique({
        where: { id: siguiente },
        select: { empresaId: true, rolId: true },
      });
      if (!padre || padre.empresaId !== empresaId) {
        throw new BadRequestException(
          'El rol superior no está disponible para esta empresa',
        );
      }
      siguiente = padre.rolId;
    }
  }

  async crear(usuarioId: number, dto: CrearRolDto): Promise<RolAdminDto> {
    await this.autorizar(usuarioId);
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
      select: { id: true },
    });
    if (!empresa)
      throw new BadRequestException('La empresa no está disponible');
    await this.validarPadre(dto.empresaId, dto.rolId);
    const descripcion = dto.descripcion.trim();
    try {
      const rol = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${dto.empresaId} FOR UPDATE`;
        const equipoCampoId = await this.resolverEquipo(tx, dto.empresaId, dto);
        return tx.rol.create({
          data: {
            descripcion,
            empresaId: dto.empresaId,
            rolId: dto.rolId ?? null,
            equipoCampoId,
          },
          select: SELECT_ROL_ADMIN,
        });
      });
      return aRolAdminDto(rol);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un rol con esa descripción en esta empresa',
        );
      }
      throw error;
    }
  }

  async actualizar(
    usuarioId: number,
    id: number,
    dto: ActualizarRolDto,
  ): Promise<RolAdminDto> {
    await this.autorizar(usuarioId);
    const existente = await this.prisma.rol.findUnique({
      where: { id },
      select: { id: true, empresaId: true, equipoCampoId: true },
    });
    if (!existente) throw new NotFoundException('El rol no existe');
    await this.validarPadre(existente.empresaId, dto.rolId, id);
    try {
      const rol = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${existente.empresaId} FOR UPDATE`;
        const equipoCampoId = await this.resolverEquipo(
          tx,
          existente.empresaId,
          dto,
          existente.equipoCampoId ?? null,
        );
        if (
          equipoCampoId !== (existente.equipoCampoId ?? null) &&
          (await tx.visitaCampo.count({
            where: { salida: null, usuario: { rolId: id } },
          }))
        )
          throw new BadRequestException(
            'Cerrá las visitas abiertas antes de cambiar el equipo del rol',
          );
        return tx.rol.update({
          where: { id },
          data: {
            descripcion: dto.descripcion?.trim(),
            rolId: dto.rolId,
            equipoCampoId,
          },
          select: SELECT_ROL_ADMIN,
        });
      });
      return aRolAdminDto(rol);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un rol con esa descripción en esta empresa',
        );
      }
      throw error;
    }
  }

  async eliminar(usuarioId: number, id: number): Promise<{ ok: true }> {
    await this.autorizar(usuarioId);
    const rol = await this.prisma.rol.findUnique({
      where: { id },
      select: { id: true, _count: { select: { usuarios: true, hijos: true } } },
    });
    if (!rol) throw new NotFoundException('El rol no existe');
    if (rol._count.usuarios > 0 || rol._count.hijos > 0) {
      throw new BadRequestException(
        'No se puede eliminar un rol que todavía está en uso',
      );
    }
    const [modulos, paginas] = await Promise.all([
      this.prisma.empresaModulo.count({ where: { rolIds: { has: id } } }),
      this.prisma.empresaPagina.count({ where: { rolIds: { has: id } } }),
    ]);
    if (modulos > 0 || paginas > 0) {
      throw new BadRequestException(
        'El rol tiene permisos de módulos o páginas asignados',
      );
    }
    await this.prisma.rol.delete({ where: { id } });
    return { ok: true };
  }
}
