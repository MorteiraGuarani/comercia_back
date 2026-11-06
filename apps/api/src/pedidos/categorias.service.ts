import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import type {
  ActualizarCategoriaDto,
  ConsultaCategoriasDto,
  CrearCategoriaDto,
} from './dto/categoria.dto';
import type { Categoria } from './interfaces/categoria.interface';

const SELECT_CATEGORIA = {
  id: true,
  nombre_categoria: true,
  codesap: true,
  Modo: true,
  orden: true,
} satisfies Prisma.CategoriaCampoSelect;

/**
 * ABM de campo_categoria para el superadmin: trabaja sobre la empresa elegida
 * y nunca toca categorías de otra.
 */
@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  private async existeEmpresa(empresaId: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no disponible');
  }

  async listar(empresaId: number, query: ConsultaCategoriasDto) {
    await this.existeEmpresa(empresaId);
    const texto = query.buscar?.trim();
    const where: Prisma.CategoriaCampoWhereInput = {
      empresaId,
      ...(texto
        ? { nombre_categoria: { contains: texto, mode: 'insensitive' } }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.categoriaCampo.count({ where }),
      this.prisma.categoriaCampo.findMany({
        where,
        select: SELECT_CATEGORIA,
        orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada<Categoria>(items, total, page, limit);
  }

  async obtener(empresaId: number, id: number): Promise<Categoria> {
    const categoria = await this.prisma.categoriaCampo.findFirst({
      where: { id, empresaId },
      select: SELECT_CATEGORIA,
    });
    if (!categoria) throw new NotFoundException('Categoría no disponible');
    return categoria;
  }

  async crear(empresaId: number, dto: CrearCategoriaDto): Promise<Categoria> {
    await this.existeEmpresa(empresaId);
    return this.prisma.categoriaCampo.create({
      data: {
        empresaId,
        nombre_categoria: dto.nombre_categoria,
        codesap: dto.codesap ?? null,
        Modo: dto.Modo ?? null,
        orden: dto.orden ?? 0,
      },
      select: SELECT_CATEGORIA,
    });
  }

  async actualizar(
    empresaId: number,
    id: number,
    dto: ActualizarCategoriaDto,
  ): Promise<Categoria> {
    // Solo cambia lo enviado; null en codesap o Modo los deja vacíos.
    const { count } = await this.prisma.categoriaCampo.updateMany({
      where: { id, empresaId },
      data: {
        nombre_categoria: dto.nombre_categoria,
        codesap: dto.codesap,
        Modo: dto.Modo,
        orden: dto.orden,
      },
    });
    if (!count) throw new NotFoundException('Categoría no disponible');
    return this.obtener(empresaId, id);
  }

  async eliminar(empresaId: number, id: number) {
    const { count } = await this.prisma.categoriaCampo.deleteMany({
      where: { id, empresaId },
    });
    if (!count) throw new NotFoundException('Categoría no disponible');
    return { ok: true };
  }
}
