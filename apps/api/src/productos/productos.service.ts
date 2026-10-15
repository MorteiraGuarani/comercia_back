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
} from './dto/catalogo.dto';
import { PRODUCTO_SELECT } from './utils/selectores';
import { productoRespuesta } from './utils/producto';
import { errorCatalogo } from './utils/error-catalogo';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  // Compartido con PreciosEspecialesService.
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
    )
      throw new NotFoundException('Empresa no disponible');
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
    const texto = { contains: query.buscar, mode: 'insensitive' as const };
    const where = {
      empresaId,
      ...(query.itemcode !== undefined ? { itemcode: query.itemcode } : {}),
      ...(query.pricelist !== undefined ? { pricelist: query.pricelist } : {}),
      ...(query.buscar
        ? {
            OR: [
              { itemcode: texto },
              { itemname: texto },
              { pricelistname: texto },
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
        orderBy: [{ itemcode: 'asc' }, { pricelist: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    if (opciones)
      return respuestaPaginada(
        items.map((p) => ({
          id: p.id.toString(),
          nombre: `${p.itemcode} · ${p.itemname} · Lista ${p.pricelist}`,
        })),
        total,
        page,
        limit,
      );
    return respuestaPaginada(items.map(productoRespuesta), total, page, limit);
  }

  async crearProducto(
    usuarioId: number,
    empresaId: number,
    dto: CrearProductoDto,
  ) {
    await this.autorizar(usuarioId, empresaId);
    try {
      const fila = await this.prisma.producto.create({
        data: { ...dto, empresaId },
        select: PRODUCTO_SELECT,
      });
      return productoRespuesta(fila);
    } catch (error: unknown) {
      errorCatalogo(error, 'Ya existe ese itemcode y pricelist en la empresa');
    }
  }

  async editarProducto(
    usuarioId: number,
    empresaId: number,
    id: string,
    dto: DatosProductoDto,
  ) {
    await this.autorizar(usuarioId, empresaId);
    try {
      const fila = await this.prisma.producto.update({
        where: { id: BigInt(id), empresaId },
        data: dto,
        select: PRODUCTO_SELECT,
      });
      return productoRespuesta(fila);
    } catch (error: unknown) {
      errorCatalogo(error, 'Ya existe ese itemcode y pricelist en la empresa');
    }
  }

  async eliminarProducto(usuarioId: number, empresaId: number, id: string) {
    await this.autorizar(usuarioId, empresaId);
    try {
      await this.prisma.producto.delete({
        where: { id: BigInt(id), empresaId },
        select: { id: true },
      });
      return { ok: true };
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }
}
