import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { esErrorDuplicado } from '../common/utils/error-prisma';
import { activosAnd } from '../common/utils/productos-activos';
import { fechaCampo, relojCampo } from '../campo/utils/calendario';
import { direccionesLocales, nombreLocal } from '../campo/utils/local-ocrd';
import type {
  BuscarClientesPedidoDto,
  ConsultaPedidosDto,
  CopiarPedidoDto,
  BuscarProductosPedidoDto,
  CrearPedidoDto,
  EditarDocumentoDto,
} from './dto/pedido.dto';
import type {
  ClientePedido,
  PerfilClientePedido,
} from './interfaces/cliente-pedido.interface';
import type { ProductoPedido } from './interfaces/producto-pedido.interface';
import type {
  CopiaPedido,
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
import {
  lineaDeGrupo,
  whereLinea,
  type LineaPedido,
} from './utils/lineas-pedido';
import type {
  DatosAlmacenUsuario,
  DocumentoSap,
  PedidoSap,
} from './interfaces/pedido-sap.interface';
import {
  almacenesDelUsuario,
  armarPedidosSap,
  conIdDocumento,
  resolverAlmacen,
  whereProductosUsuario,
} from './utils/pedido-sap';
import { ServiceLayerService } from './service-layer.service';

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
  _count: {
    select: { lineas: true, documentos: { where: { enviadoSap: true } } },
  },
  documentos: { select: { DocNum: true }, orderBy: { id: 'asc' }, take: 200 },
} satisfies Prisma.PedidoSelect;

const contiene = (texto: string) => ({
  contains: texto,
  mode: 'insensitive' as const,
});

const SELECT_DOCUMENTO = {
  id: true,
  enviadoSap: true,
  DocNum: true,
  DocDate: true,
  DocDueDate: true,
  CardCode: true,
  NumAtCard: true,
  DocCurrency: true,
  DocRate: true,
  Comments: true,
  JournalMemo: true,
  Series: true,
  U_beas_pers_id: true,
  U_beas_version: true,
  U_par: true,
  lineas: {
    select: {
      LineNum: true,
      ItemCode: true,
      Quantity: true,
      WarehouseCode: true,
    },
    orderBy: { LineNum: 'asc' },
    take: 200,
  },
} satisfies Prisma.CampoDocumentoSelect;

const SELECT_DETALLE = {
  ...SELECT_PEDIDO,
  observaciones: true,
  lineas: {
    select: {
      itemCode: true,
      nombre: true,
      linea: true,
      cantidad: true,
      precio: true,
      total: true,
    },
    orderBy: { id: 'asc' },
    take: 200,
  },
  documentos: {
    select: SELECT_DOCUMENTO,
    orderBy: { id: 'asc' },
    take: 200,
  },
} satisfies Prisma.PedidoSelect;

const SELECT_USUARIO_SAP = {
  empresaId: true,
  nombreLogin: true,
  celular: true,
  ERP_Sucursal: true,
  ERP_CanalVenta: true,
} satisfies Prisma.UsuarioSelect;

const fechaSap = (fecha: Date) =>
  `${fecha.toISOString().slice(0, 10)}T00:00:00Z`;

function aDocumento(
  d: Prisma.CampoDocumentoGetPayload<{ select: typeof SELECT_DOCUMENTO }>,
): DocumentoSap {
  const { id, enviadoSap, DocNum, lineas, ...cabecera } = d;
  return {
    id,
    enviadoSap,
    docNum: DocNum,
    sap: {
      ...cabecera,
      DocDate: fechaSap(d.DocDate),
      DocDueDate: fechaSap(d.DocDueDate),
      DocRate: Number(d.DocRate),
      DocumentLines: lineas,
    },
  };
}

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
    docNums: p.documentos.flatMap((d) => d.DocNum ?? []),
    creadoEn: p.createdAt.toISOString(),
    cantidadProductos: p._count.lineas,
    eliminable:
      p.estado === 'CARGADO' && p.docNumSap === null && !p._count.documentos,
  };
}

/**
 * Carga de pedidos de preventa: cliente de tbl_ocrd, productos de OITM por
 * línea con el precio de su lista (tbl_itm1), el pedido guardado en Comercia
 * y sus documentos enviados a SAP por almacén.
 */
@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);
  // shortcut: traba en memoria contra el doble toque, sirve con una sola instancia de la API; pasar a la base si se escala.
  private readonly enviando = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly serviceLayer: ServiceLayerService,
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
        descripcion: [direcciones.get(f.CardCode)?.direccion, f.CardCode]
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
    const u = await this.usuarioSap(usuarioId);
    const { empresaId } = u;
    const c = await this.cliente(empresaId, query.cardCode);
    const texto = query.buscar?.trim();
    const datos = await this.datosAlmacen(u);
    const where: Prisma.ProductoWhereInput = {
      AND: [
        ...activosAnd,
        whereProductosUsuario(datos),
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
        select: { itemcode: true, itemname: true, almacen: true },
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
    const almacenDe = resolverAlmacen(datos);
    return respuestaPaginada<ProductoPedido>(
      filas.map((f) => {
        const precio = precios.get(f.itemcode) ?? null;
        const almacen = almacenDe(f.almacen) || null;
        return {
          id: f.itemcode,
          itemCode: f.itemcode,
          nombre: f.itemname?.trim() || f.itemcode,
          descripcion: `${f.itemcode} · ${
            precio === null
              ? 'Sin precio'
              : `Gs. ${Math.round(precio).toLocaleString('es-PY')}`
          }${almacen ? '' : ' · Sin almacén'}`,
          precio,
          almacen,
        };
      }),
      total,
      page,
      limit,
    );
  }

  /** Arma un pedido nuevo desde otro: productos activos y precios de hoy. */
  async copiar(usuarioId: number, dto: CopiarPedidoDto): Promise<CopiaPedido> {
    const u = await this.usuarioSap(usuarioId);
    const { empresaId } = u;
    const c = await this.cliente(empresaId, dto.cardCode);
    // Una factura puede repetir un producto.
    const cantidades = new Map<string, number>();
    for (const l of dto.lineas)
      cantidades.set(
        l.itemCode,
        (cantidades.get(l.itemCode) ?? 0) + l.cantidad,
      );
    const codigos = [...cantidades.keys()];
    const datos = await this.datosAlmacen(u);
    const productos = await this.prisma.producto.findMany({
      where: {
        itemcode: { in: codigos },
        AND: [...activosAnd, whereProductosUsuario(datos)],
      },
      select: {
        itemcode: true,
        itemname: true,
        itmsgrpcode: true,
        almacen: true,
      },
      take: codigos.length,
    });
    const precios = await this.precios(empresaId, c.ListNum, codigos);
    const almacenDe = resolverAlmacen(datos);
    const activos = new Set(productos.map((p) => p.itemcode));
    return {
      cliente: { id: c.CardCode, nombre: nombreLocal(c) },
      items: productos.map((p) => ({
        itemCode: p.itemcode,
        nombre: p.itemname?.trim() || p.itemcode,
        linea: lineaDeGrupo(p.itmsgrpcode),
        // Un pedido admite enteros de 1 a 9999; la factura puede traer decimales.
        cantidad: Math.min(
          9999,
          Math.max(1, Math.round(cantidades.get(p.itemcode)!)),
        ),
        precio: precios.get(p.itemcode) ?? null,
        almacen: almacenDe(p.almacen) || null,
      })),
      noDisponibles: codigos.filter((codigo) => !activos.has(codigo)),
    };
  }

  private async usuarioSap(usuarioId: number) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: SELECT_USUARIO_SAP,
    });
    if (!u) throw new ForbiddenException('Sin acceso a pedidos');
    return u;
  }

  /**
   * Canal, sucursal y filas de tbl_owhs de esa sucursal y canal: son los únicos
   * almacenes de los que puede salir su pedido.
   */
  private async datosAlmacen(
    u: Prisma.UsuarioGetPayload<{ select: typeof SELECT_USUARIO_SAP }>,
  ): Promise<DatosAlmacenUsuario> {
    const canal = u.ERP_CanalVenta;
    const sucursal = u.ERP_Sucursal;
    const almacenes =
      sucursal === null || !canal
        ? []
        : await this.prisma.almacen.findMany({
            where: {
              empresaId: u.empresaId,
              Location: sucursal,
              GlobalLocationNumber: canal,
            },
            select: {
              WarehouseCode: true,
              WarehouseName: true,
              AddressName2: true,
              Location: true,
              GlobalLocationNumber: true,
            },
          });
    return { canal, sucursal, almacenes };
  }

  /** Arma los documentos de SAP de una carga, uno por almacén. */
  private documentosSap(
    u: Prisma.UsuarioGetPayload<{ select: typeof SELECT_USUARIO_SAP }>,
    datos: DatosAlmacenUsuario,
    cardCode: string,
    dto: CrearPedidoDto,
    almacenDe: Map<string, string | null>,
  ): PedidoSap[] {
    const { fecha, hora, segundo } = relojCampo();
    return armarPedidosSap({
      ...datos,
      cardCode,
      hoy: fecha,
      fechaEntrega: dto.fechaEntrega,
      hora,
      observaciones: dto.observaciones?.trim() ?? '',
      sello: `${fecha.replace(/-/g, '')}${hora.replace(':', '')}${segundo}`,
      usuarioLogin: u.nombreLogin,
      celular: u.celular,
      lineas: dto.lineas.map((l) => ({
        itemCode: l.itemCode,
        cantidad: l.cantidad,
        almacen: almacenDe.get(l.itemCode) ?? null,
      })),
    });
  }

  private async detalleDonde(
    where: Prisma.PedidoWhereInput,
  ): Promise<PedidoDetalle | null> {
    const p = await this.prisma.pedido.findFirst({
      where,
      select: SELECT_DETALLE,
    });
    return (
      p && {
        ...aResumen(p),
        observaciones: p.observaciones,
        lineas: p.lineas.map((l) => ({
          ...l,
          linea: l.linea as LineaPedido,
          precio: l.precio === null ? null : Number(l.precio),
          total: l.total === null ? null : Number(l.total),
        })),
        documentos: p.documentos.map(aDocumento),
      }
    );
  }

  async detalle(usuarioId: number, id: number): Promise<PedidoDetalle> {
    const pedido = await this.detalleDonde({ id, usuarioId });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    return pedido;
  }

  /** Primero guarda; después, si se pidió, va a SAP. */
  async crear(usuarioId: number, dto: CrearPedidoDto): Promise<PedidoDetalle> {
    const pedido = await this.guardarPedido(usuarioId, dto);
    return dto.enviarSap ? this.enviarPedido(usuarioId, pedido) : pedido;
  }

  /** Si SAP rechaza un documento, el pedido sigue guardado y vuelve el motivo. */
  private async enviarPedido(
    usuarioId: number,
    pedido: PedidoDetalle,
  ): Promise<PedidoDetalle> {
    const errores = new Map<number, string>();
    for (const d of pedido.documentos.filter((x) => !x.enviadoSap)) {
      try {
        await this.enviarDocumento(usuarioId, d.id);
      } catch (e) {
        errores.set(
          d.id,
          e instanceof Error ? e.message : 'No se pudo enviar a SAP',
        );
      }
    }
    const actual =
      (await this.detalleDonde({ id: pedido.id, usuarioId })) ?? pedido;
    return {
      ...actual,
      documentos: actual.documentos.map((d) => ({
        ...d,
        errorSap: errores.get(d.id),
      })),
    };
  }

  /** Crea la orden en SAP con los datos de la empresa del usuario. */
  async enviarDocumento(usuarioId: number, id: number): Promise<DocumentoSap> {
    const fila = await this.prisma.campoDocumento.findFirst({
      where: { id, usuarioId },
      select: { ...SELECT_DOCUMENTO, empresaId: true, pedidoId: true },
    });
    if (!fila) throw new NotFoundException('Documento no encontrado');
    const { empresaId, pedidoId, ...datos } = fila;
    const documento = aDocumento(datos);
    if (documento.enviadoSap) return documento;
    // Sin almacén SAP podría tomar uno por defecto y descontar de otro depósito.
    const sinAlmacen = documento.sap.DocumentLines.filter(
      (l) => !l.WarehouseCode,
    ).map((l) => l.ItemCode);
    if (sinAlmacen.length) {
      const productos = await this.prisma.pedidoLinea.findMany({
        where: { pedidoId, itemCode: { in: sinAlmacen } },
        select: { itemCode: true, nombre: true },
      });
      throw new BadRequestException(
        `Productos sin almacén: ${productos
          .map((p) => `${p.itemCode} (${p.nombre})`)
          .join(', ')}. Revisá su almacén por defecto en SAP`,
      );
    }
    if (this.enviando.has(id))
      throw new ConflictException('Este documento ya se está enviando');
    this.enviando.add(id);
    try {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { sapEsquema: true, sapUsuario: true, sapContrasenia: true },
      });
      if (
        !empresa?.sapEsquema ||
        !empresa.sapUsuario ||
        !empresa.sapContrasenia
      )
        throw new BadRequestException(
          'La empresa no tiene cargados el esquema, usuario y contraseña de SAP',
        );
      const { DocNum = null } = await this.serviceLayer.crearOrden(
        {
          esquema: empresa.sapEsquema,
          usuario: empresa.sapUsuario,
          contrasenia: empresa.sapContrasenia,
        },
        documento.sap,
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.campoDocumento.update({
          where: { id },
          data: { enviadoSap: true, DocNum },
        });
        await tx.pedido.updateMany({
          where: { id: pedidoId, docNumSap: null },
          data: { docNumSap: DocNum },
        });
        const faltan = await tx.campoDocumento.count({
          where: { pedidoId, enviadoSap: false },
        });
        if (!faltan)
          await tx.pedido.update({
            where: { id: pedidoId },
            data: { estado: 'MIGRADO' },
          });
      });
      return { ...documento, enviadoSap: true, docNum: DocNum };
    } finally {
      this.enviando.delete(id);
    }
  }

  private async guardarPedido(
    usuarioId: number,
    dto: CrearPedidoDto,
  ): Promise<PedidoDetalle> {
    const { operacionId } = dto;
    // Reintento de una sincronización: ese pedido ya quedó guardado.
    if (operacionId) {
      const repetido = await this.detalleDonde({ usuarioId, operacionId });
      if (repetido) return repetido;
    }
    const u = await this.usuarioSap(usuarioId);
    const { empresaId } = u;
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
    // Solo productos de su canal (U_beas_vg); el almacén se revisa abajo para avisar cuál falta.
    const productos = await this.prisma.producto.findMany({
      where: {
        itemcode: { in: codigos },
        tipo: u.ERP_CanalVenta ?? '',
        AND: activosAnd,
      },
      select: {
        itemcode: true,
        itemname: true,
        itmsgrpcode: true,
        almacen: true,
      },
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
    const datos = await this.datosAlmacen(u);
    const sap = this.documentosSap(
      u,
      datos,
      c.CardCode,
      dto,
      new Map(productos.map((p) => [p.itemcode, p.almacen])),
    );
    // Sin almacén SAP no puede recibirlo: no se guarda un pedido que no se va a poder enviar.
    const sinAlmacen = new Set(
      sap.flatMap((s) =>
        s.DocumentLines.filter((l) => !l.WarehouseCode).map((l) => l.ItemCode),
      ),
    );
    if (sinAlmacen.size && !almacenesDelUsuario(datos).length)
      throw new BadRequestException(
        'Tu sucursal y canal no tienen almacenes en SAP. Pedí que lo revisen',
      );
    if (sinAlmacen.size)
      throw new BadRequestException(
        `Productos sin almacén: ${lineas
          .filter((l) => sinAlmacen.has(l.itemCode))
          .map((l) => `${l.itemCode} (${l.nombre})`)
          .join(', ')}. Revisá su almacén por defecto en SAP`,
      );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pedido = await tx.pedido.create({
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
            operacionId,
            lineas: { create: lineas },
          },
          select: SELECT_PEDIDO,
        });
        const documentos: DocumentoSap[] = [];
        for (const s of sap) {
          const { DocumentLines, ...cabecera } = s;
          const { id } = await tx.campoDocumento.create({
            data: {
              ...cabecera,
              DocDate: new Date(s.DocDate),
              DocDueDate: new Date(s.DocDueDate),
              empresaId,
              usuarioId,
              pedidoId: pedido.id,
              lineas: { create: DocumentLines },
            },
            select: { id: true },
          });
          const U_beas_version = conIdDocumento(s.U_beas_version, id);
          await tx.campoDocumento.update({
            where: { id },
            data: { U_beas_version },
          });
          documentos.push({
            id,
            enviadoSap: false,
            docNum: null,
            sap: { ...s, U_beas_version },
          });
        }
        return { ...aResumen(pedido), observaciones, lineas, documentos };
      });
    } catch (e) {
      // Dos reintentos a la vez: el otro lo guardó primero.
      const repetido =
        operacionId && esErrorDuplicado(e)
          ? await this.detalleDonde({ usuarioId, operacionId })
          : null;
      if (repetido) return repetido;
      throw e;
    }
  }

  /** Solo si está guardado: con algo enviado a SAP no se borra. Lleva sus documentos. */
  async eliminar(usuarioId: number, id: number): Promise<void> {
    const { count } = await this.prisma.pedido.deleteMany({
      where: {
        id,
        usuarioId,
        estado: 'CARGADO',
        docNumSap: null,
        documentos: { none: { enviadoSap: true } },
      },
    });
    if (count) return;
    if (await this.prisma.pedido.count({ where: { id, usuarioId } }))
      throw new BadRequestException(
        'Un pedido enviado a SAP no se puede eliminar',
      );
    throw new NotFoundException('Pedido no encontrado');
  }

  /** Cambia entrega, comentario y cantidades, y mantiene el total del pedido. */
  async editarDocumento(
    usuarioId: number,
    id: number,
    dto: EditarDocumentoDto,
  ): Promise<DocumentoSap> {
    const entrega = fechaCampo(dto.DocDueDate);
    if (dto.DocDueDate <= relojCampo().fecha)
      throw new BadRequestException('La entrega tiene que ser desde mañana');
    const doc = await this.prisma.campoDocumento.findFirst({
      where: { id, usuarioId },
      select: {
        pedidoId: true,
        enviadoSap: true,
        Comments: true,
        lineas: { select: { ItemCode: true, WarehouseCode: true }, take: 200 },
      },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (doc.enviadoSap)
      throw new BadRequestException('El documento ya se envió a SAP');
    const almacenDe = new Map(
      doc.lineas.map((l) => [l.ItemCode, l.WarehouseCode]),
    );
    const cantidades = new Map(dto.lineas.map((l) => [l.ItemCode, l.Quantity]));
    if (
      cantidades.size !== dto.lineas.length ||
      [...cantidades.keys()].some((codigo) => !almacenDe.has(codigo))
    )
      throw new BadRequestException(
        'Los productos no corresponden a este documento',
      );
    const { pedidoId } = doc;
    return this.prisma.$transaction(async (tx) => {
      await tx.campoDocumentoLinea.deleteMany({ where: { documentoId: id } });
      const actualizado = await tx.campoDocumento.update({
        where: { id },
        data: {
          DocDueDate: entrega,
          // La primera línea («Migrado por Comercia…») no la cambia el usuario.
          Comments: [doc.Comments.split('\n')[0], dto.Comments.trim()]
            .filter(Boolean)
            .join('\n'),
          lineas: {
            create: dto.lineas.map((l, i) => ({
              LineNum: i,
              ItemCode: l.ItemCode,
              Quantity: l.Quantity,
              WarehouseCode: almacenDe.get(l.ItemCode)!,
            })),
          },
        },
        select: SELECT_DOCUMENTO,
      });
      await tx.pedidoLinea.deleteMany({
        where: {
          pedidoId,
          itemCode: {
            in: [...almacenDe.keys()].filter((c) => !cantidades.has(c)),
          },
        },
      });
      const lineasPedido = await tx.pedidoLinea.findMany({
        where: { pedidoId, itemCode: { in: [...cantidades.keys()] } },
        select: { id: true, itemCode: true, precio: true },
      });
      for (const l of lineasPedido) {
        const cantidad = cantidades.get(l.itemCode)!;
        await tx.pedidoLinea.update({
          where: { id: l.id },
          data: {
            cantidad,
            total: l.precio === null ? null : Number(l.precio) * cantidad,
          },
        });
      }
      const { _sum } = await tx.pedidoLinea.aggregate({
        where: { pedidoId },
        _sum: { total: true },
      });
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { total: _sum.total ?? 0 },
      });
      return aDocumento(actualizado);
    });
  }

  /** Pedidos cargados por el usuario, del más reciente al más viejo. */
  async listar(usuarioId: number, query: ConsultaPedidosDto) {
    const empresaId = await this.empresaDe(usuarioId);
    // Paraguay es UTC-3 todo el año.
    const inicioDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);
    const where = {
      empresaId,
      usuarioId,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.desde || query.hasta
        ? {
            createdAt: {
              ...(query.desde ? { gte: inicioDia(query.desde) } : {}),
              ...(query.hasta
                ? {
                    lt: new Date(inicioDia(query.hasta).getTime() + 86_400_000),
                  }
                : {}),
            },
          }
        : {}),
    };
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
