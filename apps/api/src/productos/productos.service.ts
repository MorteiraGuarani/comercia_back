import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import {
  ConsultaCatalogoDto,
  CrearProductoDto,
  DatosProductoDto,
  PrecioCatalogoDto,
} from './dto/catalogo.dto';
import { PRODUCTO_SELECT, PRECIO_SELECT } from './utils/selectores';
import { precioRespuesta } from './utils/precio';
import { errorCatalogo } from './utils/error-catalogo';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  // También lo usa PreciosEspecialesService: un solo control para el catálogo.
  async autorizar(usuarioId: number, empresaId?: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, esSuperadmin: true, isActive: true },
      select: { id: true },
    });
    if (!usuario)
      throw new ForbiddenException('Requiere permisos de superadministrador');
    if (
      empresaId !== undefined &&
      !(await this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Empresa no disponible');
    }
  }

  async empresas(usuarioId: number, query: ConsultaCatalogoDto) {
    await this.autorizar(usuarioId);
    const where = query.buscar
      ? { nombre: { contains: query.buscar, mode: 'insensitive' as const } }
      : {};
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.empresa.count({ where }),
      this.prisma.empresa.findMany({
        where,
        select: { id: true, nombre: true },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  async productos(
    usuarioId: number,
    empresaId: number,
    query: ConsultaCatalogoDto,
    opciones = false,
  ) {
    await this.autorizar(usuarioId, empresaId);
    const where = {
      empresaId,
      ...(query.buscar
        ? {
            OR: [
              {
                cardCode: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
              {
                descripcion: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        select: PRODUCTO_SELECT,
        orderBy: { cardCode: 'asc' },
        skip,
        take,
      }),
    ]);
    if (opciones)
      return respuestaPaginada(
        items.map((p) => ({
          id: p.cardCode,
          nombre: `${p.cardCode} · ${p.descripcion}`,
        })),
        total,
        page,
        limit,
      );
    return respuestaPaginada(items, total, page, limit);
  }

  async crearProducto(
    usuarioId: number,
    empresaId: number,
    dto: CrearProductoDto,
  ) {
    await this.autorizar(usuarioId, empresaId);
    try {
      return await this.prisma.producto.create({
        data: { ...dto, empresaId },
        select: PRODUCTO_SELECT,
      });
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }

  async editarProducto(
    usuarioId: number,
    empresaId: number,
    cardCode: string,
    dto: DatosProductoDto,
  ) {
    await this.autorizar(usuarioId, empresaId);
    try {
      return await this.prisma.producto.update({
        where: { empresaId_cardCode: { empresaId, cardCode } },
        data: dto,
        select: PRODUCTO_SELECT,
      });
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }

  async eliminarProducto(
    usuarioId: number,
    empresaId: number,
    cardCode: string,
  ) {
    await this.autorizar(usuarioId, empresaId);
    try {
      await this.prisma.producto.delete({
        where: { empresaId_cardCode: { empresaId, cardCode } },
        select: { cardCode: true },
      });
      return { ok: true };
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }

  async precios(
    usuarioId: number,
    empresaId: number,
    query: ConsultaCatalogoDto,
  ) {
    await this.autorizar(usuarioId, empresaId);
    const where = {
      empresaId,
      ...(query.cardCode ? { cardCode: query.cardCode } : {}),
      ...(query.buscar
        ? {
            OR: [
              {
                cardCode: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
              {
                listaPrecio: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
              {
                producto: {
                  descripcion: {
                    contains: query.buscar,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.precio.count({ where }),
      this.prisma.precio.findMany({
        where,
        select: PRECIO_SELECT,
        orderBy: [
          { cardCode: 'asc' },
          { nroListaPrecio: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items.map(precioRespuesta), total, page, limit);
  }

  async guardarPrecio(
    usuarioId: number,
    empresaId: number,
    dto: PrecioCatalogoDto,
    id?: number,
  ) {
    await this.autorizar(usuarioId, empresaId);
    const producto = await this.prisma.producto.findUnique({
      where: { empresaId_cardCode: { empresaId, cardCode: dto.cardCode } },
      select: { cardCode: true },
    });
    if (!producto)
      throw new NotFoundException('Producto no disponible en esta empresa');
    try {
      const fila = id
        ? await this.prisma.precio.update({
            where: { id, empresaId },
            data: dto,
            select: PRECIO_SELECT,
          })
        : await this.prisma.precio.create({
            data: { ...dto, empresaId },
            select: PRECIO_SELECT,
          });
      return precioRespuesta(fila);
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }

  async eliminarPrecio(usuarioId: number, empresaId: number, id: number) {
    await this.autorizar(usuarioId, empresaId);
    try {
      await this.prisma.precio.delete({
        where: { id, empresaId },
        select: { id: true },
      });
      return { ok: true };
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }
}
