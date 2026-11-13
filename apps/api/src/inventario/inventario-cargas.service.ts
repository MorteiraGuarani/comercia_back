import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { aCsv } from '../common/utils/csv';
import {
  type Prisma,
  TipoNotificacionCampo,
} from '../../generated/prisma/client';
import { fechaCampo, relojCampo } from '../campo/utils/calendario';
import {
  obtenerPersonalJefatura,
  obtenerSubordinadosActivos,
} from '../campo/utils/autorizacion';
import { nombreLocal } from '../campo/utils/local-ocrd';
import { filtrosBusquedaUsuario } from '../common/utils/busqueda-usuario';
import { puedeAdministrarUsuarios } from '../common/utils/permisos-usuario';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { diasParaVencer } from '../common/utils/vencimiento';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ConsultaCargasInventarioDto,
  OpcionesCargasInventarioDto,
} from './dto/inventario-cargas.dto';
import {
  MODULO_INVENTARIOS,
  PAGINA_CARGAS_INVENTARIO,
} from './inventario.constants';
import { estadoCarga } from './utils/estado-carga';

const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const masDias = (fecha: Date, dias: number) =>
  new Date(fecha.getTime() + dias * 86_400_000);
// shortcut: la búsqueda por nombre de producto mira hasta 200 coincidencias; ampliar si quedan cortas.
const MAX_PRODUCTOS_BUSQUEDA = 200;

// shortcut: el filtro de estado recorre hasta 1000 empresas; alcanza de sobra por ahora.
const MAX_EMPRESAS = 1000;
// Tope de la exportación a Excel: más que eso responde 413 en vez de truncar.
const LIMITE_EXPORTAR = 20_000;

const SELECT_CARGA = {
  id: true,
  empresaId: true,
  fecha: true,
  itemcode: true,
  cantidad: true,
  vencimiento: true,
  actualizadaEn: true,
  local: { select: { CardCode: true, CardName: true } },
  usuario: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      empresa: { select: { nombre: true } },
      rol: {
        select: {
          descripcion: true,
          equipoCampo: { select: { nombre: true } },
        },
      },
    },
  },
} satisfies Prisma.CargaInventarioCampoSelect;

const ORDEN_CARGAS = [
  { fecha: 'desc' },
  { actualizadaEn: 'desc' },
  { id: 'desc' },
] satisfies Prisma.CargaInventarioCampoOrderByWithRelationInput[];

const ESTADO_TEXTO: Record<ReturnType<typeof estadoCarga>, string> = {
  VENCIDO: 'Vencido',
  POR_VENCER: 'Por vencer',
  VIGENTE: 'Vigente',
};

/**
 * Consulta de lo cargado. Cada uno ve lo suyo y su cadena hacia abajo; el
 * administrador, toda su empresa; el superadmin, todas las empresas.
 */
@Injectable()
export class InventarioCargasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plataforma: AccesoPlataformaService,
  ) {}

  private async yo(usuarioId: number) {
    const yo = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        isActive: true,
        esSuperadmin: true,
        rol: { select: { descripcion: true, esAdminTi: true } },
      },
    });
    if (!yo?.isActive) throw new UnauthorizedException();
    return yo;
  }

  /** `empresaId` null: todas las empresas. `ids` null: toda la empresa. */
  private async alcance(usuarioId: number, empresaElegida?: number) {
    const yo = await this.yo(usuarioId);
    // El superadmin no depende de lo activado en una empresa.
    if (yo.esSuperadmin)
      return { empresaId: empresaElegida ?? null, ids: null };
    const u = await this.plataforma.exigirAccesoPagina(
      usuarioId,
      MODULO_INVENTARIOS,
      PAGINA_CARGAS_INVENTARIO,
    );
    const empresaEntera =
      !!yo.rol?.esAdminTi ||
      puedeAdministrarUsuarios(false, yo.rol?.descripcion ?? null);
    return {
      empresaId: u.empresaId as number | null,
      ids: empresaEntera
        ? null
        : [u.id, ...(await obtenerPersonalJefatura(this.prisma, u))],
    };
  }

  private deEmpresa(empresaId: number | null) {
    return empresaId === null ? {} : { empresaId };
  }

  private personas(
    a: { empresaId: number | null; ids: number[] | null },
    equipoId?: number,
  ): Prisma.UsuarioWhereInput {
    return {
      ...this.deEmpresa(a.empresaId),
      ...(a.ids ? { id: { in: a.ids } } : {}),
      ...(equipoId ? { rol: { equipoCampoId: equipoId } } : {}),
    };
  }

  /** Solo el superadmin elige empresa; el resto recibe la lista vacía. */
  async empresas(usuarioId: number, q: OpcionesCargasInventarioDto) {
    const { skip, take, page, limit } = rangoPaginacion(q);
    const yo = await this.yo(usuarioId);
    if (!yo.esSuperadmin) return respuestaPaginada([], 0, page, limit);
    const where: Prisma.EmpresaWhereInput = q.buscar?.trim()
      ? { nombre: { contains: q.buscar.trim(), mode: 'insensitive' } }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.empresa.count({ where }),
      this.prisma.empresa.findMany({
        where,
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  async equipos(usuarioId: number, q: OpcionesCargasInventarioDto) {
    const a = await this.alcance(usuarioId, q.empresaId);
    const where: Prisma.EquipoCampoWhereInput = {
      ...this.deEmpresa(a.empresaId),
      activo: true,
      roles: { some: { usuarios: { some: this.personas(a) } } },
      ...(q.buscar?.trim()
        ? { nombre: { contains: q.buscar.trim(), mode: 'insensitive' } }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(q);
    const [total, items] = await Promise.all([
      this.prisma.equipoCampo.count({ where }),
      this.prisma.equipoCampo.findMany({
        where,
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  async responsables(usuarioId: number, q: OpcionesCargasInventarioDto) {
    const a = await this.alcance(usuarioId, q.empresaId);
    const where: Prisma.UsuarioWhereInput = {
      ...this.personas(a, q.equipoId),
      isActive: true,
      AND: filtrosBusquedaUsuario(q.buscar),
    };
    const { skip, take, page, limit } = rangoPaginacion(q);
    const [total, filas] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          apellido: true,
          rol: { select: { descripcion: true } },
        },
        orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      filas.map((u) => ({
        id: u.id,
        nombre: `${u.nombre} ${u.apellido}`.trim(),
        descripcion: u.rol?.descripcion ?? 'Sin rol',
      })),
      total,
      page,
      limit,
    );
  }

  /**
   * Baja lógica de una carga dentro del alcance: queda en la base marcada como
   * eliminada. Sus avisos de vencimiento sí se borran, ya no corresponden.
   */
  async eliminar(usuarioId: number, id: number): Promise<void> {
    const a = await this.alcance(usuarioId);
    // Fuera del alcance responde igual que inexistente.
    const carga = await this.prisma.cargaInventarioCampo.findFirst({
      where: {
        id,
        eliminadaEn: null,
        ...this.deEmpresa(a.empresaId),
        ...(a.ids ? { usuarioId: { in: a.ids } } : {}),
      },
      select: { id: true, empresaId: true },
    });
    if (!carga) throw new NotFoundException('Carga no encontrada');
    await this.prisma.$transaction([
      this.prisma.notificacionCampo.deleteMany({
        where: {
          empresaId: carga.empresaId,
          tipo: TipoNotificacionCampo.VENCIMIENTO_PROXIMO,
          referenciaId: carga.id,
        },
      }),
      this.prisma.cargaInventarioCampo.update({
        where: { id: carga.id },
        data: { eliminadaEn: new Date(), eliminadaPorId: usuarioId },
        select: { id: true },
      }),
    ]);
  }

  async listar(usuarioId: number, q: ConsultaCargasInventarioDto) {
    const { where, hoy, diasAviso } = await this.consulta(usuarioId, q);
    const { skip, take, page, limit } = rangoPaginacion(q);
    const [total, filas] = await Promise.all([
      this.prisma.cargaInventarioCampo.count({ where }),
      this.prisma.cargaInventarioCampo.findMany({
        where,
        select: SELECT_CARGA,
        // La pantalla muestra primero lo más urgente.
        orderBy: [{ vencimiento: 'asc' }, ...ORDEN_CARGAS],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      await this.aFilas(filas, hoy, diasAviso),
      total,
      page,
      limit,
    );
  }

  /** Todas las cargas de la consulta, sin paginar, en CSV para Excel. */
  async exportar(
    usuarioId: number,
    q: ConsultaCargasInventarioDto,
  ): Promise<string> {
    const { where, hoy, diasAviso } = await this.consulta(usuarioId, q);
    const filas = await this.prisma.cargaInventarioCampo.findMany({
      where,
      select: SELECT_CARGA,
      orderBy: ORDEN_CARGAS,
      take: LIMITE_EXPORTAR + 1,
    });
    if (filas.length > LIMITE_EXPORTAR)
      throw new PayloadTooLargeException(
        `Son más de ${LIMITE_EXPORTAR} registros: acotá el período o los filtros`,
      );
    const items = await this.aFilas(filas, hoy, diasAviso);
    return aCsv(
      [
        'Fecha',
        'Empresa',
        'Cargado por',
        'Rol',
        'Equipo',
        'Código local',
        'Local',
        'Código producto',
        'Producto',
        'Cantidad',
        'Vencimiento',
        'Días para vencer',
        'Estado',
      ],
      items.map((c) => [
        c.fecha,
        c.usuario.empresa,
        c.usuario.nombre,
        c.usuario.rol,
        c.usuario.equipo,
        c.local.id,
        c.local.nombre,
        c.itemcode,
        c.producto,
        c.cantidad,
        c.vencimiento,
        c.diasParaVencer,
        ESTADO_TEXTO[c.estado],
      ]),
    );
  }

  /** Filtro común del listado y la exportación. */
  private async consulta(usuarioId: number, q: ConsultaCargasInventarioDto) {
    const a = await this.alcance(usuarioId, q.empresaId);
    if (q.responsableId && a.ids && !a.ids.includes(q.responsableId))
      throw new ForbiddenException('No tenés acceso a esta sección');
    // Sin empresa elegida (superadmin), la cadena es la de la empresa del responsable.
    const empresaResponsable =
      a.empresaId ??
      (q.responsableId
        ? (
            await this.prisma.usuario.findUnique({
              where: { id: q.responsableId },
              select: { empresaId: true },
            })
          )?.empresaId
        : null);
    const cadena = q.responsableId
      ? [
          q.responsableId,
          ...(empresaResponsable
            ? await obtenerSubordinadosActivos(
                this.prisma,
                q.responsableId,
                empresaResponsable,
              )
            : []),
        ]
      : null;
    const visibles = cadena
      ? cadena.filter((id) => !a.ids || a.ids.includes(id))
      : a.ids;

    const hoy = relojCampo().fecha;
    const inicioHoy = fechaCampo(hoy);
    // Cada empresa define sus días de aviso.
    const empresas = await this.prisma.empresa.findMany({
      where: a.empresaId === null ? {} : { id: a.empresaId },
      select: { id: true, diasAvisoVencimiento: true },
      take: MAX_EMPRESAS,
    });
    const diasAviso = new Map(
      empresas.map((e) => [e.id, e.diasAvisoVencimiento]),
    );
    const rangoEstado = (
      dias: number,
    ): Record<string, Prisma.DateTimeFilter> => ({
      VENCIDO: { lt: inicioHoy },
      POR_VENCER: { gte: inicioHoy, lte: masDias(inicioHoy, dias) },
      VIGENTE: { gt: masDias(inicioHoy, dias) },
    });

    const buscar = q.buscar?.trim();
    const productosBuscados = buscar
      ? await this.prisma.producto.findMany({
          where: { itemname: { contains: buscar, mode: 'insensitive' } },
          select: { itemcode: true },
          take: MAX_PRODUCTOS_BUSQUEDA,
        })
      : [];
    const where: Prisma.CargaInventarioCampoWhereInput = {
      ...this.deEmpresa(a.empresaId),
      eliminadaEn: null,
      fecha: {
        gte: fechaCampo(q.desde ?? hoy),
        lte: fechaCampo(q.hasta ?? q.desde ?? hoy),
      },
      ...(visibles ? { usuarioId: { in: visibles } } : {}),
      ...(q.equipoId
        ? { usuario: { rol: { equipoCampoId: q.equipoId } } }
        : {}),
      AND: [
        ...(q.estado
          ? [
              {
                OR: empresas.map((e) => ({
                  empresaId: e.id,
                  vencimiento: rangoEstado(e.diasAvisoVencimiento)[q.estado!],
                })),
              },
            ]
          : []),
        ...(buscar
          ? [
              {
                OR: [
                  { localId: { contains: buscar, mode: 'insensitive' } },
                  {
                    local: {
                      CardName: { contains: buscar, mode: 'insensitive' },
                    },
                  },
                  { itemcode: { contains: buscar, mode: 'insensitive' } },
                  {
                    itemcode: { in: productosBuscados.map((p) => p.itemcode) },
                  },
                ] as Prisma.CargaInventarioCampoWhereInput[],
              },
            ]
          : []),
      ],
    };
    return { where, hoy, diasAviso };
  }

  private async aFilas(
    filas: Prisma.CargaInventarioCampoGetPayload<{
      select: typeof SELECT_CARGA;
    }>[],
    hoy: string,
    diasAviso: Map<number, number>,
  ) {
    const nombres = new Map(
      (
        await this.prisma.producto.findMany({
          where: { itemcode: { in: filas.map((f) => f.itemcode) } },
          select: { itemcode: true, itemname: true },
          take: filas.length,
        })
      ).map((p) => [p.itemcode, p.itemname]),
    );
    return filas.map((f) => {
      const dias = diasParaVencer(f.vencimiento, hoy);
      return {
        id: f.id,
        fecha: dia(f.fecha),
        local: { id: f.local.CardCode, nombre: nombreLocal(f.local) },
        itemcode: f.itemcode,
        producto: nombres.get(f.itemcode) ?? f.itemcode,
        cantidad: f.cantidad,
        vencimiento: dia(f.vencimiento),
        diasParaVencer: dias,
        estado: estadoCarga(dias, diasAviso.get(f.empresaId) ?? 0),
        usuario: {
          id: f.usuario.id,
          nombre: `${f.usuario.nombre} ${f.usuario.apellido}`.trim(),
          rol: f.usuario.rol?.descripcion ?? 'Sin rol',
          equipo: f.usuario.rol?.equipoCampo?.nombre ?? null,
          empresa: f.usuario.empresa.nombre,
        },
        cargadaEn: f.actualizadaEn.toISOString(),
      };
    });
  }
}
