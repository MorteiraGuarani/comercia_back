import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import {
  ConsultaCatalogoDto,
  CrearProductoDto,
  DatosProductoDto,
} from './dto/catalogo.dto';
import type { ProductoFila } from './interfaces/producto.interface';
import { ARTICULO_SELECT, PRODUCTO_SELECT } from './utils/selectores';
import { productoRespuesta } from './utils/producto';
import { datosMaestroLegacy } from './utils/maestro-legacy';
import { errorCatalogo } from './utils/error-catalogo';
import {
  PRODUCTOS_POR_BLOQUE,
  TIMEOUT_LOTE_PRODUCTOS_MS,
} from './productos.constants';
@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}
  async autorizar(usuarioId: number, empresaId?: number) {
    if (
      !(await this.prisma.usuario.findFirst({
        where: { id: usuarioId, esSuperadmin: true, isActive: true },
        select: { id: true },
      }))
    )
      throw new ForbiddenException('Requiere permisos de superadministrador');
    if (empresaId !== undefined) await this.comprobarEmpresa(empresaId);
  }
  private async comprobarEmpresa(empresaId: number) {
    if (
      !(await this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Empresa no disponible');
  }
  private async nombreLista(
    tx: Prisma.TransactionClient,
    empresaId: number,
    dto: DatosProductoDto,
  ) {
    if (dto.pricelistname === undefined) return;
    await tx.socioNegocioListaPrecio.upsert({
      where: { empresaId_ListNum: { empresaId, ListNum: dto.pricelist } },
      create: {
        empresaId,
        ListNum: dto.pricelist,
        ListName: dto.pricelistname,
      },
      update: { ListName: dto.pricelistname },
    });
  }
  async empresas(query: ConsultaCatalogoDto) {
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
  private async respuestas(empresaId: number, filas: ProductoFila[]) {
    const codigos = [...new Set(filas.map((f) => f.pricelist))];
    const articulos = filas.length
      ? await this.prisma.producto.findMany({
          where: {
            itemcode: { in: [...new Set(filas.map((f) => f.itemcode))] },
          },
          select: ARTICULO_SELECT,
        })
      : [];
    const porCodigo = new Map(articulos.map((p) => [p.itemcode, p]));
    const listas = codigos.length
      ? await this.prisma.socioNegocioListaPrecio.findMany({
          where: { empresaId, ListNum: { in: codigos } },
          select: { ListNum: true, ListName: true },
          take: codigos.length,
        })
      : [];
    const nombres = new Map(listas.map((l) => [l.ListNum!, l.ListName]));
    return filas.map((f) =>
      productoRespuesta(f, nombres, porCodigo.get(f.itemcode) ?? null),
    );
  }
  async productos(
    empresaId: number,
    query: ConsultaCatalogoDto,
    opciones = false,
  ) {
    await this.comprobarEmpresa(empresaId);
    const texto = { contains: query.buscar, mode: 'insensitive' as const };
    const articulosCoincidentes = query.buscar
      ? await this.prisma.producto.findMany({
          where: { itemname: texto },
          select: { itemcode: true },
        })
      : [];
    const where = {
      empresaId,
      ...(query.itemcode !== undefined ? { itemcode: query.itemcode } : {}),
      ...(query.pricelist !== undefined ? { pricelist: query.pricelist } : {}),
      ...(query.buscar
        ? {
            OR: [
              { itemcode: texto },
              {
                itemcode: { in: articulosCoincidentes.map((p) => p.itemcode) },
              },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, filas] = await Promise.all([
      this.prisma.productoPrecio.count({ where }),
      this.prisma.productoPrecio.findMany({
        where,
        select: PRODUCTO_SELECT,
        orderBy: [{ itemcode: 'asc' }, { pricelist: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    const items = await this.respuestas(empresaId, filas);
    if (opciones)
      return respuestaPaginada(
        items.map((p) => ({
          id: p.id,
          nombre:
            p.itemcode +
            ' · ' +
            (p.itemname ?? 'Sin nombre') +
            ' · Lista ' +
            p.pricelist,
        })),
        total,
        page,
        limit,
      );
    return respuestaPaginada(items, total, page, limit);
  }
  async crearProducto(empresaId: number, dto: CrearProductoDto) {
    await this.comprobarEmpresa(empresaId);
    try {
      const fila = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM empresas WHERE id=${empresaId} FOR UPDATE`;
        await tx.producto.createMany({
          data: [datosMaestroLegacy(dto)],
          skipDuplicates: true,
        });
        await this.nombreLista(tx, empresaId, dto);
        return tx.productoPrecio.create({
          data: {
            empresaId,
            itemcode: dto.itemcode,
            pricelist: dto.pricelist,
            price: dto.price,
          },
          select: PRODUCTO_SELECT,
        });
      });
      return (await this.respuestas(empresaId, [fila]))[0];
    } catch (e: unknown) {
      errorCatalogo(e, 'Ya existe ese ItemCode y PriceList en la empresa');
    }
  }
  async crearProductos(empresaId: number, dtos: CrearProductoDto[]) {
    await this.comprobarEmpresa(empresaId);
    const vistas = new Set<string>();
    const maestros = new Map<string, CrearProductoDto>();
    const unicos = dtos.filter((d) => {
      const k = JSON.stringify([d.itemcode, d.pricelist]);
      if (vistas.has(k)) return false;
      vistas.add(k);
      if (!maestros.has(d.itemcode)) maestros.set(d.itemcode, d);
      return true;
    });
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM empresas WHERE id=${empresaId} FOR UPDATE`;
        const articulos = [...maestros.values()];
        const listas = new Map<number, string | null>();
        for (const d of unicos)
          if (d.pricelistname !== undefined && !listas.has(d.pricelist))
            listas.set(d.pricelist, d.pricelistname);
        const nombres = [...listas].map(([ListNum, ListName]) => ({
          empresaId,
          ListNum,
          ListName,
        }));
        for (let i = 0; i < nombres.length; i += PRODUCTOS_POR_BLOQUE)
          await tx.socioNegocioListaPrecio.createMany({
            data: nombres.slice(i, i + PRODUCTOS_POR_BLOQUE),
            skipDuplicates: true,
          });
        for (let i = 0; i < articulos.length; i += PRODUCTOS_POR_BLOQUE)
          await tx.producto.createMany({
            data: articulos
              .slice(i, i + PRODUCTOS_POR_BLOQUE)
              .map((d) => datosMaestroLegacy(d)),
            skipDuplicates: true,
          });
        let insertados = 0;
        for (let i = 0; i < unicos.length; i += PRODUCTOS_POR_BLOQUE)
          insertados += (
            await tx.productoPrecio.createMany({
              data: unicos.slice(i, i + PRODUCTOS_POR_BLOQUE).map((d) => ({
                empresaId,
                itemcode: d.itemcode,
                pricelist: d.pricelist,
                price: d.price,
              })),
              skipDuplicates: true,
            })
          ).count;
        return {
          recibidos: dtos.length,
          insertados,
          existentes: unicos.length - insertados,
          duplicadosEnLote: dtos.length - unicos.length,
          omitidos: dtos.length - insertados,
        };
      },
      { maxWait: 5000, timeout: TIMEOUT_LOTE_PRODUCTOS_MS },
    );
  }
  async editarProducto(
    empresaId: number,
    ItemCode: string,
    PriceList: number,
    dto: DatosProductoDto,
  ) {
    await this.comprobarEmpresa(empresaId);
    try {
      const fila = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM empresas WHERE id=${empresaId} FOR UPDATE`;
        const where = {
          empresaId_itemcode_pricelist: {
            empresaId,
            itemcode: ItemCode,
            pricelist: PriceList,
          },
        };
        if (
          !(await tx.productoPrecio.findUnique({ where, select: { id: true } }))
        )
          throw new NotFoundException('Registro no disponible en esta empresa');
        await tx.producto.upsert({
          where: { itemcode: dto.itemcode },
          create: datosMaestroLegacy(dto),
          update: datosMaestroLegacy(dto),
        });
        await this.nombreLista(tx, empresaId, dto);
        return tx.productoPrecio.update({
          where,
          data: {
            itemcode: dto.itemcode,
            pricelist: dto.pricelist,
            price: dto.price,
          },
          select: PRODUCTO_SELECT,
        });
      });
      return (await this.respuestas(empresaId, [fila]))[0];
    } catch (e: unknown) {
      errorCatalogo(e, 'Ya existe ese ItemCode y PriceList en la empresa');
    }
  }
  async eliminarProducto(
    empresaId: number,
    ItemCode: string,
    PriceList: number,
  ) {
    await this.comprobarEmpresa(empresaId);
    try {
      await this.prisma.productoPrecio.delete({
        where: {
          empresaId_itemcode_pricelist: {
            empresaId,
            itemcode: ItemCode,
            pricelist: PriceList,
          },
        },
        select: { id: true },
      });
      return { ok: true };
    } catch (e: unknown) {
      errorCatalogo(e);
    }
  }
}
