import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  rangoPaginacion,
  respuestaPaginada,
  type PaginacionDto,
  type RespuestaPaginada,
} from '../common/utils/paginacion';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarEmpresaAdminDto,
  CrearEmpresaAdminDto,
} from './dto/empresa-admin.dto';
import type {
  EmpresaAdminDto,
  EmpresaAdminFila,
} from './interfaces/empresa-admin.interface';
import { esEmpresaJerarquiaFila } from './utils/empresa-jerarquia';
import { relanzarDuplicado } from '../common/utils/error-prisma';

const SELECT_EMPRESA_ADMIN = {
  id: true,
  nombre: true,
  dbName: true,
  diasAvisoVencimiento: true,
  padre: { select: { id: true, nombre: true } },
  _count: {
    select: {
      usuarios: true,
      hijas: true,
      modulos: true,
      paginas: true,
    },
  },
} as const;

function aEmpresaAdminDto(empresa: EmpresaAdminFila): EmpresaAdminDto {
  return {
    id: empresa.id,
    nombre: empresa.nombre,
    dbName: empresa.dbName,
    diasAvisoVencimiento: empresa.diasAvisoVencimiento,
    padre: empresa.padre,
    usuariosCount: empresa._count.usuarios,
    hijasCount: empresa._count.hijas,
    configuracionCount: empresa._count.modulos + empresa._count.paginas,
  };
}

@Injectable()
export class AdminEmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: PaginacionDto,
  ): Promise<RespuestaPaginada<EmpresaAdminDto>> {
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, empresas] = await Promise.all([
      this.prisma.empresa.count(),
      this.prisma.empresa.findMany({
        select: SELECT_EMPRESA_ADMIN,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      empresas.map(aEmpresaAdminDto),
      total,
      page,
      limit,
    );
  }

  private async validarPadre(
    empresaId: number | null | undefined,
    empresaActualId?: number,
  ): Promise<void> {
    if (empresaId === undefined || empresaId === null) return;
    if (empresaId === empresaActualId) {
      throw new BadRequestException(
        'Una empresa no puede ser su propia empresa matriz',
      );
    }

    let actualId: number | null = empresaId;
    const visitadas = new Set<number>();
    while (actualId !== null) {
      if (actualId === empresaActualId || visitadas.has(actualId)) {
        throw new BadRequestException('La jerarquía de empresas no es válida');
      }
      visitadas.add(actualId);
      const empresa: unknown = await this.prisma.empresa.findUnique({
        where: { id: actualId },
        select: { empresaId: true },
      });
      if (!esEmpresaJerarquiaFila(empresa)) {
        throw new BadRequestException(
          'La empresa matriz seleccionada no existe',
        );
      }
      actualId = empresa.empresaId;
    }
  }

  async crear(dto: CrearEmpresaAdminDto): Promise<EmpresaAdminDto> {
    await this.validarPadre(dto.empresaId);
    try {
      const empresa = await this.prisma.empresa.create({
        data: {
          nombre: dto.nombre.trim(),
          dbName: dto.dbName?.trim() || null,
          empresaId: dto.empresaId ?? null,
          diasAvisoVencimiento: dto.diasAvisoVencimiento,
        },
        select: SELECT_EMPRESA_ADMIN,
      });
      return aEmpresaAdminDto(empresa);
    } catch (error: unknown) {
      relanzarDuplicado(error, 'Ya existe una empresa con ese nombre');
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarEmpresaAdminDto,
  ): Promise<EmpresaAdminDto> {
    const existente = await this.prisma.empresa.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('La empresa no existe');
    await this.validarPadre(dto.empresaId, id);
    try {
      const empresa = await this.prisma.empresa.update({
        where: { id },
        data: {
          nombre: dto.nombre?.trim(),
          dbName:
            dto.dbName === undefined ? undefined : dto.dbName?.trim() || null,
          empresaId: dto.empresaId,
          diasAvisoVencimiento: dto.diasAvisoVencimiento,
        },
        select: SELECT_EMPRESA_ADMIN,
      });
      return aEmpresaAdminDto(empresa);
    } catch (error: unknown) {
      relanzarDuplicado(error, 'Ya existe una empresa con ese nombre');
    }
  }

  async eliminar(id: number): Promise<{ ok: true }> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: {
            roles: true,
            tareasCampo: true,
            usuarios: true,
            hijas: true,
            modulos: true,
            paginas: true,
          },
        },
      },
    });
    if (!empresa) throw new NotFoundException('La empresa no existe');
    const dependencias = Object.values(empresa._count).some(
      (cantidad) => cantidad > 0,
    );
    if (dependencias) {
      throw new BadRequestException(
        'No se puede eliminar una empresa que todavía tiene datos asociados',
      );
    }
    await this.prisma.empresa.delete({ where: { id } });
    return { ok: true };
  }
}
