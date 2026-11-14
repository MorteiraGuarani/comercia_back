import {
  BadRequestException,
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
import type { Categoria, GrupoOitb } from './interfaces/categoria.interface';

const SELECT_CATEGORIA = {
  id: true,
  nombre_categoria: true,
  ItemGroupCode: true,
  Modo: true,
  orden: true,
} satisfies Prisma.CategoriaCampoSelect;

type FilaCategoria = Prisma.CategoriaCampoGetPayload<{
  select: typeof SELECT_CATEGORIA;
}>;

/**
 * ABM de campo_categoria para superadmin y Admin TI: trabaja sobre la empresa
 * elegida y nunca toca categorías de otra.
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

  /** Suma el nombre del grupo de OITB a cada categoría. */
  private async conGrupo(
    empresaId: number,
    filas: FilaCategoria[],
  ): Promise<Categoria[]> {
    const numeros = [...new Set(filas.flatMap((f) => f.ItemGroupCode ?? []))];
    const grupos = numeros.length
      ? await this.prisma.grupoArticulo.findMany({
          where: { empresaId, Number: { in: numeros } },
          select: { Number: true, GroupName: true },
          take: numeros.length,
        })
      : [];
    const nombres = new Map(grupos.map((g) => [g.Number, g.GroupName]));
    return filas.map((f) => ({
      ...f,
      grupo:
        f.ItemGroupCode === null
          ? null
          : (nombres.get(f.ItemGroupCode)?.trim() ?? null),
    }));
  }

  /** El grupo tiene que existir en tbl_oitb de la misma empresa. */
  private async validarGrupo(empresaId: number, numero?: number | null) {
    if (numero === undefined || numero === null) return;
    const grupo = await this.prisma.grupoArticulo.findFirst({
      where: { empresaId, Number: numero },
      select: { id: true },
    });
    if (!grupo)
      throw new BadRequestException(
        `El grupo ${numero} no existe en los grupos de artículos (OITB) de la empresa`,
      );
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
    const [total, filas] = await Promise.all([
      this.prisma.categoriaCampo.count({ where }),
      this.prisma.categoriaCampo.findMany({
        where,
        select: SELECT_CATEGORIA,
        orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada<Categoria>(
      await this.conGrupo(empresaId, filas),
      total,
      page,
      limit,
    );
  }

  /** Grupos de artículos de OITB de la empresa, para elegir el de la categoría. */
  async grupos(empresaId: number, query: ConsultaCategoriasDto) {
    await this.existeEmpresa(empresaId);
    const texto = query.buscar?.trim();
    const numero = texto && /^\d{1,9}$/.test(texto) ? Number(texto) : null;
    const where: Prisma.GrupoArticuloWhereInput = {
      empresaId,
      ...(texto
        ? {
            OR: [
              { GroupName: { contains: texto, mode: 'insensitive' } },
              ...(numero === null ? [] : [{ Number: numero }]),
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, filas] = await Promise.all([
      this.prisma.grupoArticulo.count({ where }),
      this.prisma.grupoArticulo.findMany({
        where,
        select: { Number: true, GroupName: true },
        orderBy: [{ GroupName: 'asc' }, { Number: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada<GrupoOitb>(
      filas.map((g) => ({
        id: g.Number,
        nombre: g.GroupName?.trim() || `Grupo ${g.Number}`,
        descripcion: `Código ${g.Number}`,
      })),
      total,
      page,
      limit,
    );
  }

  async obtener(empresaId: number, id: number): Promise<Categoria> {
    const categoria = await this.prisma.categoriaCampo.findFirst({
      where: { id, empresaId },
      select: SELECT_CATEGORIA,
    });
    if (!categoria) throw new NotFoundException('Categoría no disponible');
    return (await this.conGrupo(empresaId, [categoria]))[0];
  }

  async crear(empresaId: number, dto: CrearCategoriaDto): Promise<Categoria> {
    await this.existeEmpresa(empresaId);
    await this.validarGrupo(empresaId, dto.ItemGroupCode);
    const creada = await this.prisma.categoriaCampo.create({
      data: {
        empresaId,
        nombre_categoria: dto.nombre_categoria,
        ItemGroupCode: dto.ItemGroupCode ?? null,
        Modo: dto.Modo ?? null,
        orden: dto.orden ?? 0,
      },
      select: SELECT_CATEGORIA,
    });
    return (await this.conGrupo(empresaId, [creada]))[0];
  }

  async actualizar(
    empresaId: number,
    id: number,
    dto: ActualizarCategoriaDto,
  ): Promise<Categoria> {
    await this.validarGrupo(empresaId, dto.ItemGroupCode);
    // Solo cambia lo enviado; null en ItemGroupCode o Modo los deja vacíos.
    const { count } = await this.prisma.categoriaCampo.updateMany({
      where: { id, empresaId },
      data: {
        nombre_categoria: dto.nombre_categoria,
        ItemGroupCode: dto.ItemGroupCode,
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
