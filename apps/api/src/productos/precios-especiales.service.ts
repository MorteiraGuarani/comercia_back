import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { ProductosService } from './productos.service';
import {
  ConsultaPrecioEspecialDto,
  PrecioEspecialDetalleDto,
  PrecioEspecialDto,
} from './dto/precio-especial.dto';
import {
  PRECIO_ESPECIAL_DETALLE_SELECT,
  PRECIO_ESPECIAL_SELECT,
} from './utils/selectores';
import {
  precioEspecialDetalleRespuesta,
  precioEspecialRespuesta,
} from './utils/precio-especial';
import { errorCatalogo } from './utils/error-catalogo';

const DUPLICADO_CABECERA =
  'Ya existe un precio especial con ese artículo, lista, cliente y tipo en la empresa';
const DUPLICADO_DETALLE =
  'Ya existe un detalle con ese cliente, artículo, línea y lista en la empresa';

@Injectable()
export class PreciosEspecialesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: ProductosService,
  ) {}

  async listar(
    usuarioId: number,
    empresaId: number,
    query: ConsultaPrecioEspecialDto,
  ) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    const texto = { contains: query.buscar, mode: 'insensitive' as const };
    const where = {
      empresaId,
      ...(query.cardCode ? { cardCode: query.cardCode } : {}),
      ...(query.itemCode ? { itemCode: query.itemCode } : {}),
      ...(query.buscar
        ? {
            OR: [
              { cardCode: texto },
              { cardName: texto },
              { itemCode: texto },
              { itemName: texto },
              { listPriceName: texto },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.precioEspecial.count({ where }),
      this.prisma.precioEspecial.findMany({
        where,
        select: PRECIO_ESPECIAL_SELECT,
        orderBy: [
          { cardCode: 'asc' },
          { itemCode: 'asc' },
          { listPriceCod: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      items.map(precioEspecialRespuesta),
      total,
      page,
      limit,
    );
  }

  async crear(usuarioId: number, empresaId: number, dto: PrecioEspecialDto) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    try {
      const fila = await this.prisma.precioEspecial.create({
        data: { ...dto, empresaId },
        select: PRECIO_ESPECIAL_SELECT,
      });
      return precioEspecialRespuesta(fila);
    } catch (error: unknown) {
      errorCatalogo(error, DUPLICADO_CABECERA);
    }
  }

  async editar(
    usuarioId: number,
    empresaId: number,
    id: string,
    dto: PrecioEspecialDto,
  ) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    try {
      const fila = await this.prisma.precioEspecial.update({
        where: { id: BigInt(id), empresaId },
        data: dto,
        select: PRECIO_ESPECIAL_SELECT,
      });
      return precioEspecialRespuesta(fila);
    } catch (error: unknown) {
      errorCatalogo(error, DUPLICADO_CABECERA);
    }
  }

  async eliminar(usuarioId: number, empresaId: number, id: string) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    try {
      await this.prisma.precioEspecial.delete({
        where: { id: BigInt(id), empresaId },
        select: { id: true },
      });
      return { ok: true };
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }

  async listarDetalle(
    usuarioId: number,
    empresaId: number,
    query: ConsultaPrecioEspecialDto,
  ) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    const texto = { contains: query.buscar, mode: 'insensitive' as const };
    const where = {
      empresaId,
      ...(query.cardCode ? { cardCode: query.cardCode } : {}),
      ...(query.itemCode ? { itemCode: query.itemCode } : {}),
      ...(query.buscar
        ? {
            OR: [{ cardCode: texto }, { itemCode: texto }, { currency: texto }],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.precioEspecialDetalle.count({ where }),
      this.prisma.precioEspecialDetalle.findMany({
        where,
        select: PRECIO_ESPECIAL_DETALLE_SELECT,
        orderBy: [
          { cardCode: 'asc' },
          { itemCode: 'asc' },
          { lineNum: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      items.map(precioEspecialDetalleRespuesta),
      total,
      page,
      limit,
    );
  }

  async crearDetalle(
    usuarioId: number,
    empresaId: number,
    dto: PrecioEspecialDetalleDto,
  ) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    try {
      const fila = await this.prisma.precioEspecialDetalle.create({
        data: { ...dto, empresaId },
        select: PRECIO_ESPECIAL_DETALLE_SELECT,
      });
      return precioEspecialDetalleRespuesta(fila);
    } catch (error: unknown) {
      errorCatalogo(error, DUPLICADO_DETALLE);
    }
  }

  async editarDetalle(
    usuarioId: number,
    empresaId: number,
    id: string,
    dto: PrecioEspecialDetalleDto,
  ) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    try {
      const fila = await this.prisma.precioEspecialDetalle.update({
        where: { id: BigInt(id), empresaId },
        data: dto,
        select: PRECIO_ESPECIAL_DETALLE_SELECT,
      });
      return precioEspecialDetalleRespuesta(fila);
    } catch (error: unknown) {
      errorCatalogo(error, DUPLICADO_DETALLE);
    }
  }

  async eliminarDetalle(usuarioId: number, empresaId: number, id: string) {
    await this.catalogo.autorizar(usuarioId, empresaId);
    try {
      await this.prisma.precioEspecialDetalle.delete({
        where: { id: BigInt(id), empresaId },
        select: { id: true },
      });
      return { ok: true };
    } catch (error: unknown) {
      errorCatalogo(error);
    }
  }
}
