import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  rangoPaginacion,
  respuestaPaginada,
  type PaginacionDto,
} from '../common/utils/paginacion';
import { activosAnd } from '../common/utils/productos-activos';
import { fechaCampo, relojCampo } from '../campo/utils/calendario';
import { direccionesLocales, nombreLocal } from '../campo/utils/local-ocrd';
import type {
  BuscarClientesPedidoDto,
  BuscarProductosPedidoDto,
  CrearPedidoDto,
} from './dto/pedido.dto';
import type {
  ClientePedido,
  PerfilClientePedido,
} from './interfaces/cliente-pedido.interface';
import type { ProductoPedido } from './interfaces/producto-pedido.interface';
import type {
  LineaPedidoRespuesta,
  PedidoDetalle,
  PedidoResumen,
} from './interfaces/pedido.interface';
import type {
  CreditoCliente,
  FilaEstadoCredito,
} from './interfaces/credito-cliente.interface';
import type {
  FacturaCliente,
  FilaDetalleFactura,
  FilaFacturaCliente,
  LineaFacturaCliente,
} from './interfaces/factura-cliente.interface';
import { aCreditoCliente } from './utils/credito-cliente';
import { aFacturaCliente, aLineaFactura } from './utils/facturas-cliente';
import { lineaDeGrupo, whereLinea } from './utils/lineas-pedido';

// Cliente habilitado en SAP: si está inhabilitado no se le carga el pedido.
const CLIENTE_ACTIVO = {
  CardType: 'C',
  validFor: { not: 'N' },
  frozenFor: { not: 'Y' },
} satisfies Prisma.SocioNegocioWhereInput;

const DIAS_VISITA = [
  ['QryLunes', 'Lunes'],
  ['QryMartes', 'Martes'],
  ['QryMiercoles', 'Miércoles'],
  ['QryJueves', 'Jueves'],
  ['QryViernes', 'Viernes'],
] as const;

const SELECT_PEDIDO = {
  id: true,
  cardCode: true,
  clienteNombre: true,
  fechaEntrega: true,
  estado: true,
  total: true,
  docNumSap: true,
  createdAt: true,
  _count: { select: { lineas: true } },
} satisfies Prisma.PedidoSelect;

const contiene = (texto: string) => ({
  contains: texto,
  mode: 'insensitive' as const,
});

function aResumen(
  p: Prisma.PedidoGetPayload<{ select: typeof SELECT_PEDIDO }>,
): PedidoResumen {
  return {
    id: p.id,
    numero: `PV-${p.id}`,
    cliente: { id: p.cardCode, nombre: p.clienteNombre },
    fechaEntrega: p.fechaEntrega.toISOString().slice(0, 10),
    estado: p.estado,
    total: Number(p.total),
    docNumSap: p.docNumSap,
    creadoEn: p.createdAt.toISOString(),
    cantidadProductos: p._count.lineas,
  };
}

/**
 * Carga de pedidos de preventa: cliente de tbl_ocrd, productos de OITM por
 * línea con el precio de su lista (tbl_itm1) y el pedido guardado en Comercia.
 * Todavía no consulta crédito ni envía nada a SAP.
 */
@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Ejecuta un procedimiento de FG_PROD por el gateway UniversalBack. Devuelve
   * sus filas, o null (ya registrado) si no está configurado o no responde.
   */
  private async procedimiento<T>(
    nombre: string,
    params: (string | number)[],
    contexto: string,
  ): Promise<T[] | null> {
    const base = this.config
      .get<string>('integrations.sapApiUrl')
      ?.replace(/\/$/, '');
    if (!base) {
      this.logger.error(`${contexto}: falta SAP_API_URL en el entorno`);
      return null;
    }
    const url = `${base}/execute/procedure`;
    const inicio = Date.now();
    try {
      const respuesta = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: 'FG_PROD',
          procedureName: nombre,
          params,
        }),
      });
      const texto = await respuesta.text();
      let filas: unknown = null;
      try {
        filas = JSON.parse(texto);
      } catch {
        // La respuesta puede contener datos del cliente o de sus facturas.
      }
      if (!respuesta.ok || !Array.isArray(filas)) {
        this.logger.error(
          `${contexto}: SAP respondió HTTP ${respuesta.status} en ${
            Date.now() - inicio
          } ms · respuesta inválida`,
        );
        return null;
      }
      return filas as T[];
    } catch (error) {
      // fetch de Node envuelve el error de red real (ECONNREFUSED, ETIMEDOUT…) en cause.
      const causa =
        error instanceof Error && error.cause instanceof Error
          ? ` · causa: ${error.cause.message}`
          : '';
      this.logger.error(
        `${contexto}: no se pudo llamar a SAP en ${
          Date.now() - inicio
        } ms · POST ${url} · ${
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error)
        }${causa}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * Estado de crédito del cliente en SAP: SP_ESTADO_CREDITO_CLIENTES.
   * null si no está configurado o no responde.
   */
  // shortcut: sin respuesta de SAP el pedido se permite; bloquearlo cuando el pedido vaya a SAP.
  private async credito(cardCode: string): Promise<CreditoCliente | null> {
    const contexto = `Estado de crédito de ${cardCode}`;
    const filas = await this.procedimiento<FilaEstadoCredito>(
      'SP_ESTADO_CREDITO_CLIENTES',
      [cardCode],
      contexto,
    );
    if (filas && !filas.length)
      this.logger.error(
        `${contexto}: sin filas (el cliente no está en OCRD de SAP o no es CardType C)`,
      );
    return filas?.length ? aCreditoCliente(filas) : null;
  }

  /** Últimas facturas del cliente en SAP; 503 si SAP no responde. */
  private async facturasSap(cardCode: string): Promise<FacturaCliente[]> {
    const filas = await this.procedimiento<FilaFacturaCliente>(
      'SP_ULTIMAS_4_FACTURAS_CLIENTE',
      [cardCode],
      `Últimas facturas de ${cardCode}`,
    );
    if (!filas)
      throw new ServiceUnavailableException(
        'No se pudieron consultar las facturas en SAP',
      );
    return filas.map(aFacturaCliente);
  }

  /**
   * Últimas facturas del cliente (la más reciente primero).
   * Sin paginar: el SP devuelve como máximo 4.
   */
  async facturas(
    usuarioId: number,
    cardCode: string,
  ): Promise<FacturaCliente[]> {
    const empresaId = await this.empresaDe(usuarioId);
    const c = await this.cliente(empresaId, cardCode);
    return this.facturasSap(c.CardCode);
  }

  /** Líneas de una de las últimas facturas del cliente. */
  async detalleFactura(
    usuarioId: number,
    cardCode: string,
    docEntry: number,
  ): Promise<LineaFacturaCliente[]> {
    const empresaId = await this.empresaDe(usuarioId);
    const c = await this.cliente(empresaId, cardCode);
    // Solo facturas del cliente: un DocEntry ajeno responde igual que uno inexistente.
    const propias = await this.facturasSap(c.CardCode);
    if (!propias.some((f) => f.docEntry === docEntry))
      throw new NotFoundException('Factura no disponible');
    const filas = await this.procedimiento<FilaDetalleFactura>(
      'SP_DETALLE_FACTURA_CLIENTE',
      [docEntry],
      `Detalle de la factura ${docEntry}`,
    );
    if (!filas)
      throw new ServiceUnavailableException(
        'No se pudo consultar el detalle en SAP',
      );
    return filas.map(aLineaFactura);
  }

  private async empresaDe(usuarioId: number) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { empresaId: true },
    });
    if (!u) throw new ForbiddenException('Sin acceso a pedidos');
    return u.empresaId;
  }

  private async cliente(empresaId: number, cardCode: string) {
    const c = await this.prisma.socioNegocio.findFirst({
      where: { empresaId, CardCode: cardCode, ...CLIENTE_ACTIVO },
      select: {
        CardCode: true,
        CardName: true,
        AliasName: true,
        LicTradNum: true,
        Phone1: true,
        U_jCANAL: true,
        GroupNum: true,
        ListNum: true,
        QryLunes: true,
        QryMartes: true,
        QryMiercoles: true,
        QryJueves: true,
        QryViernes: true,
      },
    });
    if (!c) throw new NotFoundException('Cliente no disponible');
    return c;
  }

  /** Precio por ItemCode en la lista del cliente; sin lista, ninguno. */
  private async precios(
    empresaId: number,
    lista: number | null,
    itemCodes: string[],
  ) {
    if (lista === null || !itemCodes.length) return new Map<string, number>();
    const filas = await this.prisma.productoPrecio.findMany({
      where: { empresaId, pricelist: lista, itemcode: { in: itemCodes } },
      select: { itemcode: true, price: true },
    });
    return new Map(
      filas.flatMap((f) =>
        f.price === null ? [] : [[f.itemcode, Number(f.price)] as const],
      ),
    );
  }

  async clientes(usuarioId: number, query: BuscarClientesPedidoDto) {
    const empresaId = await this.empresaDe(usuarioId);
    const texto = query.buscar?.trim();
    const where: Prisma.SocioNegocioWhereInput = {
      empresaId,
      ...CLIENTE_ACTIVO,
      ...(texto
        ? {
            OR: [
              { CardCode: contiene(texto) },
              { CardName: contiene(texto) },
              { AliasName: contiene(texto) },
            ],
          }
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
      empresaId,
      filas.map((f) => f.CardCode),
    );
    return respuestaPaginada<ClientePedido>(
      filas.map((f) => ({
        id: f.CardCode,
        nombre: nombreLocal(f),
        descripcion: [f.CardCode, direcciones.get(f.CardCode)?.direccion]
          .filter(Boolean)
          .join(' · '),
      })),
      total,
      page,
      limit,
    );
  }

  async perfil(
    usuarioId: number,
    cardCode: string,
  ): Promise<PerfilClientePedido> {
    const empresaId = await this.empresaDe(usuarioId);
    const c = await this.cliente(empresaId, cardCode);
    const codigoCanal = Number(c.U_jCANAL);
    const [direcciones, condicion, lista, canal, credito] = await Promise.all([
      direccionesLocales(this.prisma, empresaId, [c.CardCode]),
      c.GroupNum === null
        ? null
        : this.prisma.socioNegocioCondicionPago.findFirst({
            where: { empresaId, GroupNumber: c.GroupNum },
            select: { PaymentTermsGroupName: true },
          }),
      c.ListNum === null
        ? null
        : this.prisma.socioNegocioListaPrecio.findFirst({
            where: { empresaId, ListNum: c.ListNum },
            select: { ListName: true },
          }),
      Number.isInteger(codigoCanal)
        ? this.prisma.socioNegocioCanales.findFirst({
            where: { empresaId, Code: codigoCanal },
            select: { Name: true },
          })
        : null,
      this.credito(c.CardCode),
    ]);
    return {
      id: c.CardCode,
      nombre: nombreLocal(c),
      direccion: direcciones.get(c.CardCode)?.direccion ?? '',
      alias: c.AliasName?.trim() ?? '',
      ruc: c.LicTradNum ?? '',
      telefono: c.Phone1 ?? '',
      canal: canal?.Name?.trim() || c.U_jCANAL?.trim() || null,
      condicionPago: condicion?.PaymentTermsGroupName?.trim() || null,
      listaPrecios:
        lista?.ListName?.trim() ||
        (c.ListNum === null ? null : `Lista ${c.ListNum}`),
      diasVisita: DIAS_VISITA.filter(([campo]) => c[campo] === 'Y').map(
        ([, dia]) => dia,
      ),
      credito,
    };
  }

  async productos(usuarioId: number, query: BuscarProductosPedidoDto) {
    const empresaId = await this.empresaDe(usuarioId);
    const c = await this.cliente(empresaId, query.cardCode);
    const texto = query.buscar?.trim();
    // shortcut: sin filtro por perfil del vendedor (U_beas_vg); agregarlo cuando exista el perfil.
    const where: Prisma.ProductoWhereInput = {
      AND: [
        ...activosAnd,
        whereLinea(query.linea),
        ...(texto
          ? [
              {
                OR: [
                  { itemcode: contiene(texto) },
                  { itemname: contiene(texto) },
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
    const precios = await this.precios(
      empresaId,
      c.ListNum,
      filas.map((f) => f.itemcode),
    );
    return respuestaPaginada<ProductoPedido>(
      filas.map((f) => {
        const precio = precios.get(f.itemcode) ?? null;
        return {
          id: f.itemcode,
          itemCode: f.itemcode,
          nombre: f.itemname?.trim() || f.itemcode,
          descripcion: `${f.itemcode} · ${
            precio === null
              ? 'Sin precio'
              : `Gs. ${Math.round(precio).toLocaleString('es-PY')}`
          }`,
          precio,
        };
      }),
      total,
      page,
      limit,
    );
  }

  async crear(usuarioId: number, dto: CrearPedidoDto): Promise<PedidoDetalle> {
    const empresaId = await this.empresaDe(usuarioId);
    const c = await this.cliente(empresaId, dto.cardCode);
    const entrega = fechaCampo(dto.fechaEntrega);
    if (dto.fechaEntrega <= relojCampo().fecha)
      throw new BadRequestException('La entrega tiene que ser desde mañana');
    const credito = await this.credito(c.CardCode);
    if (credito && !credito.habilitado)
      throw new BadRequestException(
        `El cliente está inhabilitado en SAP${credito.motivo ? `: ${credito.motivo}` : ''}`,
      );
    const codigos = dto.lineas.map((l) => l.itemCode);
    if (new Set(codigos).size !== codigos.length)
      throw new BadRequestException('Hay productos repetidos en el pedido');
    const productos = await this.prisma.producto.findMany({
      where: { itemcode: { in: codigos }, AND: activosAnd },
      select: { itemcode: true, itemname: true, itmsgrpcode: true },
    });
    const porCodigo = new Map(productos.map((p) => [p.itemcode, p]));
    const faltan = codigos.filter((codigo) => !porCodigo.has(codigo));
    if (faltan.length)
      throw new BadRequestException(
        `Productos no disponibles: ${faltan.join(', ')}`,
      );
    // El precio sale de la lista del cliente, nunca del navegador.
    const precios = await this.precios(empresaId, c.ListNum, codigos);
    const lineas: LineaPedidoRespuesta[] = dto.lineas.map((l) => {
      const p = porCodigo.get(l.itemCode)!;
      const precio = precios.get(l.itemCode) ?? null;
      return {
        itemCode: p.itemcode,
        nombre: p.itemname?.trim() || p.itemcode,
        linea: lineaDeGrupo(p.itmsgrpcode),
        cantidad: l.cantidad,
        precio,
        total: precio === null ? null : precio * l.cantidad,
      };
    });
    const total = lineas.reduce((suma, l) => suma + (l.total ?? 0), 0);
    const observaciones = dto.observaciones?.trim() ?? '';
    const pedido = await this.prisma.pedido.create({
      data: {
        empresaId,
        usuarioId,
        cardCode: c.CardCode,
        clienteNombre: nombreLocal(c),
        listaPrecios: c.ListNum,
        condicionPago: c.GroupNum,
        fechaEntrega: entrega,
        observaciones,
        total,
        lineas: { create: lineas },
      },
      select: SELECT_PEDIDO,
    });
    return { ...aResumen(pedido), observaciones, lineas };
  }

  /** Pedidos cargados por el usuario, del más reciente al más viejo. */
  async listar(usuarioId: number, query: PaginacionDto) {
    const empresaId = await this.empresaDe(usuarioId);
    const where = { empresaId, usuarioId };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, filas] = await Promise.all([
      this.prisma.pedido.count({ where }),
      this.prisma.pedido.findMany({
        where,
        select: SELECT_PEDIDO,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(filas.map(aResumen), total, page, limit);
  }
}
