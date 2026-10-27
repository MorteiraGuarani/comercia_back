import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  rangoPaginacion,
  respuestaPaginada,
  type RespuestaPaginada,
} from '../common/utils/paginacion';
import { fechaCampo, relojCampo } from '../campo/utils/calendario';
import { localesParaNovedad } from '../campo/utils/locales-novedad';
import { direccionesLocales, nombreLocal } from '../campo/utils/local-ocrd';
import {
  DIAS_CARGA_DIFERIDA,
  LIMITE_LOCALES_COPIA,
  LIMITE_PRODUCTOS_COPIA,
  MODULO_INVENTARIO,
  PAGINA_INVENTARIO,
} from './inventario.constants';
import type { ItemCopiaInventario } from './interfaces/item-copia-inventario.interface';
import type {
  AgregarProductosInventarioDto,
  BuscarInventarioDto,
  ConfiguracionInventarioDto,
  ConsultaInventarioLocalDto,
  GuardarCargasInventarioDto,
} from './dto/inventario-local.dto';
import { diasParaVencer } from '../common/utils/vencimiento';
import { VencimientosService } from './vencimientos.service';

const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);

// Activos en SAP: válidos y no congelados.
const activosAnd: Prisma.ProductoWhereInput[] = [
  { OR: [{ validFor: null }, { validFor: { not: 'N' } }] },
  { OR: [{ frozenFor: null }, { frozenFor: { not: 'Y' } }] },
];
const productosActivos = (empresaId: number): Prisma.ProductoWhereInput => ({
  empresaId,
  AND: activosAnd,
});

/**
 * Inventario por local: productos de tbl_oitm asociados a cada cliente de
 * tbl_ocrd, con la carga diaria de cantidad y vencimiento. Solo el día de
 * hoy se edita; los días anteriores son de consulta.
 */
@Injectable()
export class InventarioLocalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plataforma: AccesoPlataformaService,
    private readonly vencimientos: VencimientosService,
  ) {}

  private acceso(usuarioId: number) {
    return this.plataforma.exigirAccesoPagina(
      usuarioId,
      MODULO_INVENTARIO,
      PAGINA_INVENTARIO,
    );
  }

  private async local(empresaId: number, localId: string) {
    const local = await this.prisma.socioNegocio.findFirst({
      where: { empresaId, CardCode: localId },
      select: { CardCode: true, CardName: true },
    });
    if (!local) throw new NotFoundException('Local no disponible');
    return local;
  }

  /** Locales de la ruta del usuario (asignados o ya visitados). */
  async locales(usuarioId: number, query: BuscarInventarioDto) {
    const u = await this.acceso(usuarioId);
    const where: Prisma.SocioNegocioWhereInput = {
      ...localesParaNovedad(usuarioId, u.empresaId),
      ...(query.buscar
        ? { CardName: { contains: query.buscar, mode: 'insensitive' } }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, filas] = await Promise.all([
      this.prisma.socioNegocio.count({ where }),
      this.prisma.socioNegocio.findMany({
        where,
        select: { CardCode: true, CardName: true },
        orderBy: [{ CardName: 'asc' }, { CardCode: 'asc' }],
        skip,
        take,
      }),
    ]);
    const direcciones = await direccionesLocales(
      this.prisma,
      u.empresaId,
      filas.map((l) => l.CardCode),
    );
    return respuestaPaginada(
      filas.map((l) => ({
        id: l.CardCode,
        nombre: nombreLocal(l),
        direccion: direcciones.get(l.CardCode)?.direccion ?? '',
      })),
      total,
      page,
      limit,
    );
  }

  /**
   * Copia para trabajar sin conexión: los productos activos de tbl_oitm y los
   * locales de la ruta con sus productos, la carga de hoy y los días con carga
   * del último mes. Se entrega completa o no se entrega: el navegador la toma
   * como la única versión vigente.
   */
  async copia(usuarioId: number) {
    const u = await this.acceso(usuarioId);
    const hoy = relojCampo().fecha;
    const [empresa, yo, productos, locales] = await Promise.all([
      this.prisma.empresa.findUniqueOrThrow({
        where: { id: u.empresaId },
        select: { diasAvisoVencimiento: true },
      }),
      this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { localPrincipalId: true },
      }),
      this.prisma.producto.findMany({
        where: productosActivos(u.empresaId),
        select: { itemcode: true, itemname: true, inventory: true },
        orderBy: [{ itemname: 'asc' }, { itemcode: 'asc' }],
        take: LIMITE_PRODUCTOS_COPIA + 1,
      }),
      this.prisma.socioNegocio.findMany({
        where: localesParaNovedad(usuarioId, u.empresaId),
        select: { CardCode: true, CardName: true },
        orderBy: [{ CardName: 'asc' }, { CardCode: 'asc' }],
        take: LIMITE_LOCALES_COPIA + 1,
      }),
    ]);
    if (
      productos.length > LIMITE_PRODUCTOS_COPIA ||
      locales.length > LIMITE_LOCALES_COPIA
    )
      throw new PayloadTooLargeException(
        'El inventario supera el máximo que se puede guardar en el equipo',
      );
    const delLocal = {
      empresaId: u.empresaId,
      localId: { in: locales.map((l) => l.CardCode) },
    };
    const desde = dia(new Date(fechaCampo(hoy).getTime() - 30 * 86_400_000));
    const [asociados, cargas, dias, direcciones] = await Promise.all([
      this.prisma.productoLocalCampo.findMany({
        where: delLocal,
        select: {
          localId: true,
          itemcode: true,
          producto: { select: { itemname: true } },
        },
        orderBy: [{ creadoEn: 'asc' }, { itemcode: 'asc' }],
        take: LIMITE_PRODUCTOS_COPIA + 1,
      }),
      this.prisma.cargaInventarioCampo.findMany({
        where: { ...delLocal, fecha: fechaCampo(hoy) },
        select: {
          localId: true,
          itemcode: true,
          cantidad: true,
          vencimiento: true,
        },
        take: LIMITE_PRODUCTOS_COPIA + 1,
      }),
      this.prisma.cargaInventarioCampo.groupBy({
        by: ['localId', 'fecha'],
        where: {
          ...delLocal,
          fecha: { gte: fechaCampo(desde), lt: fechaCampo(hoy) },
        },
        orderBy: [{ localId: 'asc' }, { fecha: 'desc' }],
        take: locales.length * 31,
      }),
      direccionesLocales(
        this.prisma,
        u.empresaId,
        locales.map((l) => l.CardCode),
      ),
    ]);
    if (
      asociados.length > LIMITE_PRODUCTOS_COPIA ||
      cargas.length > LIMITE_PRODUCTOS_COPIA
    )
      throw new PayloadTooLargeException(
        'El inventario supera el máximo que se puede guardar en el equipo',
      );
    const cargaDe = new Map(
      cargas.map((c) => [`${c.localId}\u0000${c.itemcode}`, c]),
    );
    const itemsDe = new Map<string, ItemCopiaInventario[]>();
    for (const a of asociados) {
      const carga = cargaDe.get(`${a.localId}\u0000${a.itemcode}`);
      const lista = itemsDe.get(a.localId) ?? [];
      lista.push({
        itemcode: a.itemcode,
        itemname: a.producto.itemname ?? a.itemcode,
        cantidad: carga?.cantidad ?? null,
        vencimiento: carga ? dia(carga.vencimiento) : null,
      });
      itemsDe.set(a.localId, lista);
    }
    const fechasDe = new Map<string, string[]>();
    for (const d of dias)
      fechasDe.set(d.localId, [
        ...(fechasDe.get(d.localId) ?? []),
        dia(d.fecha),
      ]);
    return {
      usuarioId,
      hoy,
      diasAviso: empresa.diasAvisoVencimiento,
      // Se abre directo en la pantalla; solo si es uno de los locales de su ruta.
      localPrincipalId: locales.some((l) => l.CardCode === yo.localPrincipalId)
        ? yo.localPrincipalId
        : null,
      productos: productos.map((p) => ({
        itemcode: p.itemcode,
        itemname: p.itemname ?? p.itemcode,
        // QryInventario = 'Y': se precarga en el inventario de todos los locales.
        inventario: p.inventory === 'Y',
      })),
      locales: locales.map((l) => ({
        id: l.CardCode,
        nombre: nombreLocal(l),
        direccion: direcciones.get(l.CardCode)?.direccion ?? '',
        fechas: fechasDe.get(l.CardCode) ?? [],
        items: itemsDe.get(l.CardCode) ?? [],
      })),
    };
  }

  /** Productos activos de tbl_oitm para agregar al local. */
  async productos(usuarioId: number, query: BuscarInventarioDto) {
    const u = await this.acceso(usuarioId);
    const where: Prisma.ProductoWhereInput = {
      empresaId: u.empresaId,
      AND: [
        ...activosAnd,
        ...(query.buscar
          ? [
              {
                OR: [
                  {
                    itemname: {
                      contains: query.buscar,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    itemcode: {
                      contains: query.buscar,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, filas] = await Promise.all([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        select: { itemcode: true, itemname: true },
        orderBy: [{ itemname: 'asc' }, { itemcode: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      filas.map((p) => ({
        id: p.itemcode,
        nombre: `${p.itemname ?? p.itemcode} · ${p.itemcode}`,
      })),
      total,
      page,
      limit,
    );
  }

  /**
   * Hoy: los productos asociados al local con lo cargado en el día. Otro día:
   * lo que se cargó esa fecha (consulta).
   */
  async detalle(
    usuarioId: number,
    localId: string,
    query: ConsultaInventarioLocalDto,
  ) {
    const u = await this.acceso(usuarioId);
    const local = await this.local(u.empresaId, localId);
    const hoy = relojCampo().fecha;
    const fecha = query.fecha ?? hoy;
    const delLocal = { empresaId: u.empresaId, localId };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [empresa, productosTotal, cargadosHoy, fechas] = await Promise.all([
      this.prisma.empresa.findUniqueOrThrow({
        where: { id: u.empresaId },
        select: { diasAvisoVencimiento: true },
      }),
      this.prisma.productoLocalCampo.count({ where: delLocal }),
      this.prisma.cargaInventarioCampo.count({
        where: { ...delLocal, fecha: fechaCampo(hoy) },
      }),
      this.prisma.cargaInventarioCampo.findMany({
        where: { ...delLocal, fecha: { lt: fechaCampo(hoy) } },
        distinct: ['fecha'],
        select: { fecha: true },
        orderBy: { fecha: 'desc' },
        take: 30,
      }),
    ]);
    const item = (
      itemcode: string,
      itemname: string | null,
      carga?: { cantidad: number; vencimiento: Date },
    ) => ({
      itemcode,
      itemname: itemname ?? itemcode,
      cantidad: carga?.cantidad ?? null,
      vencimiento: carga ? dia(carga.vencimiento) : null,
      diasParaVencer: carga ? diasParaVencer(carga.vencimiento, hoy) : null,
    });
    let pagina: RespuestaPaginada<ReturnType<typeof item>>;
    if (fecha === hoy) {
      const [total, productos] = await Promise.all([
        Promise.resolve(productosTotal),
        this.prisma.productoLocalCampo.findMany({
          where: delLocal,
          select: { itemcode: true, producto: { select: { itemname: true } } },
          orderBy: [{ creadoEn: 'asc' }, { itemcode: 'asc' }],
          skip,
          take,
        }),
      ]);
      const cargas = await this.prisma.cargaInventarioCampo.findMany({
        where: {
          ...delLocal,
          fecha: fechaCampo(hoy),
          itemcode: { in: productos.map((p) => p.itemcode) },
        },
        select: { itemcode: true, cantidad: true, vencimiento: true },
        take: productos.length,
      });
      const porCodigo = new Map(cargas.map((c) => [c.itemcode, c]));
      pagina = respuestaPaginada(
        productos.map((p) =>
          item(p.itemcode, p.producto.itemname, porCodigo.get(p.itemcode)),
        ),
        total,
        page,
        limit,
      );
    } else {
      const where = { ...delLocal, fecha: fechaCampo(fecha) };
      const [total, cargas] = await Promise.all([
        this.prisma.cargaInventarioCampo.count({ where }),
        this.prisma.cargaInventarioCampo.findMany({
          where,
          select: {
            itemcode: true,
            cantidad: true,
            vencimiento: true,
            producto: { select: { itemname: true } },
          },
          orderBy: [{ producto: { itemname: 'asc' } }, { itemcode: 'asc' }],
          skip,
          take,
        }),
      ]);
      pagina = respuestaPaginada(
        cargas.map((c) => item(c.itemcode, c.producto.itemname, c)),
        total,
        page,
        limit,
      );
    }
    return {
      ...pagina,
      local: { id: local.CardCode, nombre: nombreLocal(local) },
      hoy,
      fecha,
      editable: fecha === hoy,
      diasAviso: empresa.diasAvisoVencimiento,
      fechas: fechas.map((f) => dia(f.fecha)),
      productosTotal,
      cargadosHoy,
    };
  }

  async agregarProductos(
    usuarioId: number,
    localId: string,
    dto: AgregarProductosInventarioDto,
  ) {
    const u = await this.acceso(usuarioId);
    await this.local(u.empresaId, localId);
    const existentes = await this.prisma.producto.count({
      where: { empresaId: u.empresaId, itemcode: { in: dto.itemcodes } },
    });
    if (existentes !== dto.itemcodes.length)
      throw new BadRequestException('Producto no disponible en la empresa');
    const { count } = await this.prisma.productoLocalCampo.createMany({
      data: dto.itemcodes.map((itemcode) => ({
        empresaId: u.empresaId,
        localId,
        itemcode,
      })),
      skipDuplicates: true,
    });
    return { agregados: count };
  }

  async quitarProducto(usuarioId: number, localId: string, itemcode: string) {
    const u = await this.acceso(usuarioId);
    const { count } = await this.prisma.productoLocalCampo.deleteMany({
      where: { empresaId: u.empresaId, localId, itemcode },
    });
    if (!count) throw new NotFoundException('Producto no disponible');
    return { ok: true };
  }

  /**
   * Guarda la carga del día (hoy, o el día en que se hizo sin conexión); un
   * vencimiento nuevo vuelve a habilitar su aviso.
   */
  async guardarCargas(
    usuarioId: number,
    localId: string,
    dto: GuardarCargasInventarioDto,
  ) {
    const u = await this.acceso(usuarioId);
    await this.local(u.empresaId, localId);
    const codigos = dto.cargas.map((c) => c.itemcode);
    if (new Set(codigos).size !== codigos.length)
      throw new BadRequestException('Hay productos repetidos en la carga');
    const delLocal = { empresaId: u.empresaId, localId };
    const asociados = await this.prisma.productoLocalCampo.count({
      where: { ...delLocal, itemcode: { in: codigos } },
    });
    if (asociados !== codigos.length)
      throw new BadRequestException(
        'Agregá primero el producto al inventario del local',
      );
    // Una carga hecha sin conexión conserva el día en que se hizo.
    const hoy = relojCampo().fecha;
    const minimo = dia(
      new Date(fechaCampo(hoy).getTime() - DIAS_CARGA_DIFERIDA * 86_400_000),
    );
    const diaCarga = dto.fecha ?? hoy;
    if (diaCarga > hoy || diaCarga < minimo)
      throw new BadRequestException(
        `La carga debe ser de hoy o de los últimos ${DIAS_CARGA_DIFERIDA} días`,
      );
    const fecha = fechaCampo(diaCarga);
    await this.prisma.$transaction(async (tx) => {
      const actuales = await tx.cargaInventarioCampo.findMany({
        where: { ...delLocal, fecha, itemcode: { in: codigos } },
        select: { itemcode: true, vencimiento: true },
        take: codigos.length,
      });
      const vencimientoActual = new Map(
        actuales.map((c) => [c.itemcode, dia(c.vencimiento)]),
      );
      for (const carga of dto.cargas) {
        const vencimiento = fechaCampo(carga.vencimiento);
        await tx.cargaInventarioCampo.upsert({
          where: {
            empresaId_localId_itemcode_fecha: {
              ...delLocal,
              itemcode: carga.itemcode,
              fecha,
            },
          },
          create: {
            ...delLocal,
            itemcode: carga.itemcode,
            fecha,
            cantidad: carga.cantidad,
            vencimiento,
            usuarioId,
          },
          update: {
            cantidad: carga.cantidad,
            vencimiento,
            usuarioId,
            ...(vencimientoActual.get(carga.itemcode) !== carga.vencimiento
              ? { avisadoEn: null }
              : {}),
          },
          select: { id: true },
        });
      }
    });
    // Si ya está dentro del plazo, el aviso sale ahora y no en la próxima pasada.
    void this.vencimientos.procesar();
    return { guardadas: dto.cargas.length };
  }

  private async accesoConfiguracion(usuarioId: number) {
    try {
      return await this.plataforma.exigirAccesoPagina(
        usuarioId,
        'gestion-campo',
        'locales',
      );
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { empresaId: true, isActive: true, esSuperadmin: true },
      });
      if (!usuario?.isActive || !usuario.esSuperadmin) throw error;
      return usuario;
    }
  }

  async configuracion(usuarioId: number) {
    const u = await this.accesoConfiguracion(usuarioId);
    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id: u.empresaId },
      select: { diasAvisoVencimiento: true },
    });
    return { diasAviso: empresa.diasAvisoVencimiento };
  }

  async guardarConfiguracion(
    usuarioId: number,
    dto: ConfiguracionInventarioDto,
  ) {
    const u = await this.accesoConfiguracion(usuarioId);
    await this.prisma.empresa.update({
      where: { id: u.empresaId },
      data: { diasAvisoVencimiento: dto.diasAviso },
      select: { id: true },
    });
    void this.vencimientos.procesar();
    return { diasAviso: dto.diasAviso };
  }
}
