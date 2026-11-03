import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

/** ABM de campo_categoria: cada empresa ve y edita solo las suyas. */
@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  private async empresaDe(usuarioId: number) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { empresaId: true },
    });
    if (!u) throw new ForbiddenException('Sin acceso a categorías');
    return u.empresaId;
  }

  async listar(usuarioId: number, query: ConsultaCategoriasDto) {
    const empresaId = await this.empresaDe(usuarioId);
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

  async obtener(usuarioId: number, id: number): Promise<Categoria> {
    const empresaId = await this.empresaDe(usuarioId);
    const categoria = await this.prisma.categoriaCampo.findFirst({
      where: { id, empresaId },
      select: SELECT_CATEGORIA,
    });
    if (!categoria) throw new NotFoundException('Categoría no disponible');
    return categoria;
  }

  async crear(usuarioId: number, dto: CrearCategoriaDto): Promise<Categoria> {
    const empresaId = await this.empresaDe(usuarioId);
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
    usuarioId: number,
    id: number,
    dto: ActualizarCategoriaDto,
  ): Promise<Categoria> {
    const empresaId = await this.empresaDe(usuarioId);
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
    return this.obtener(usuarioId, id);
  }

  async eliminar(usuarioId: number, id: number) {
    const empresaId = await this.empresaDe(usuarioId);
    const { count } = await this.prisma.categoriaCampo.deleteMany({
      where: { id, empresaId },
    });
    if (!count) throw new NotFoundException('Categoría no disponible');
    return { ok: true };
  }
}
