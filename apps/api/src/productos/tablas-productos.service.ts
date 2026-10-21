import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  RegistroTabla,
  RepositorioTabla,
} from '../common/interfaces/repositorio-tabla.interface';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { errorTabla } from './utils/error-tabla';
import { ProductosService } from './productos.service';
import type { TablaProductos } from './interfaces/tabla-productos.interface';
import { ConsultaTablasDto } from './dto/consulta-tablas.dto';
import {
  entradaTabla,
  salidaTabla,
  seleccionTabla,
  claveTabla,
  filtroClaveTabla,
} from './utils/tabla-productos';
import {
  PRODUCTOS_POR_BLOQUE,
  TIMEOUT_LOTE_PRODUCTOS_MS,
} from './productos.constants';

@Injectable()
export class TablasProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: ProductosService,
  ) {}
  private modelo(
    tx: Prisma.TransactionClient,
    t: TablaProductos,
  ): RepositorioTabla {
    return tx[t.modelo] as unknown as RepositorioTabla;
  }
  private async acceso(
    t: TablaProductos,
    empresaId: number,
    usuarioId?: number,
  ) {
    if (t.protegida) return this.catalogo.autorizar(usuarioId ?? 0, empresaId);
    if (
      !(await this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Empresa no disponible');
  }
  async listar(
    t: TablaProductos,
    empresaId: number,
    q: ConsultaTablasDto,
    usuarioId?: number,
  ) {
    await this.acceso(t, empresaId, usuarioId);
    const where: Record<string, unknown> = { empresaId };
    for (const campo of [
      'ItemCode',
      'CardCode',
      'PriceList',
      'ListNum',
    ] as const)
      if (q[campo] !== undefined && t.columnas[campo])
        where[t.columnas[campo]] = q[campo];
    if (q.buscar) {
      const busquedas: Record<string, unknown>[] = t.textos.map((c) => ({
        [t.columnas[c]]: { contains: q.buscar, mode: 'insensitive' },
      }));
      const numero = Number(q.buscar);
      if (
        /^-?\d+$/.test(q.buscar) &&
        Number.isInteger(numero) &&
        numero >= -2147483648 &&
        numero <= 2147483647
      )
        busquedas.push(
          ...t.clave
            .filter((c) => !t.textos.includes(c))
            .map((c) => ({ [t.columnas[c]]: numero })),
        );
      where.OR = busquedas;
    }
    const { skip, take, page, limit } = rangoPaginacion(q);
    const m = this.modelo(this.prisma, t);
    const [total, rows] = await Promise.all([
      m.count({ where }),
      m.findMany({
        where,
        select: seleccionTabla(t),
        skip,
        take,
        orderBy: { id: 'asc' },
      }),
    ]);
    return respuestaPaginada(
      rows.map((r) => salidaTabla(t, r)),
      total,
      page,
      limit,
    );
  }
  async obtener(
    t: TablaProductos,
    empresaId: number,
    clave: Record<string, unknown>,
    usuarioId?: number,
  ) {
    await this.acceso(t, empresaId, usuarioId);
    const fila = await this.modelo(this.prisma, t).findFirst({
      where: filtroClaveTabla(t, empresaId, clave),
      select: seleccionTabla(t),
    });
    if (!fila)
      throw new NotFoundException('Registro no disponible en esta empresa');
    return salidaTabla(t, fila);
  }
  async crear(
    t: TablaProductos,
    empresaId: number,
    datos: Record<string, unknown> | Record<string, unknown>[],
    usuarioId?: number,
  ) {
    await this.acceso(t, empresaId, usuarioId);
    const lote = Array.isArray(datos);
    const filas = lote ? datos : [datos];
    const claves = new Set<string>();
    const unicas = filas.filter((f) => {
      const clave = claveTabla(t, f);
      if (claves.has(clave)) return false;
      claves.add(clave);
      return true;
    });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM empresas WHERE id=${empresaId} FOR UPDATE`;
          const m = this.modelo(tx, t);
          const entradas = unicas.map((f) => ({
            ...entradaTabla(t, f),
            empresaId,
          }));
          if (!lote)
            return salidaTabla(
              t,
              await m.create({ data: entradas[0], select: seleccionTabla(t) }),
            );
          let insertados = 0;
          for (let i = 0; i < entradas.length; i += PRODUCTOS_POR_BLOQUE)
            insertados += (
              await m.createMany({
                data: entradas.slice(i, i + PRODUCTOS_POR_BLOQUE),
                skipDuplicates: true,
              })
            ).count;
          return {
            recibidos: filas.length,
            insertados,
            existentes: unicas.length - insertados,
            duplicadosEnLote: filas.length - unicas.length,
            omitidos: filas.length - insertados,
          };
        },
        { maxWait: 5000, timeout: TIMEOUT_LOTE_PRODUCTOS_MS },
      );
    } catch (e: unknown) {
      errorTabla(e);
    }
  }
  private async proteger(
    tx: Prisma.TransactionClient,
    t: TablaProductos,
    empresaId: number,
    fila: RegistroTabla,
  ) {
    const where = { empresaId, itemCode: fila[t.columnas.ItemCode] as string };
    if (t.nombre === 'tbl_oitm') {
      if (
        (await tx.precioEspecial.count({ where })) ||
        (await tx.precioEspecialDetalle.count({ where })) ||
        (await tx.precioEspecialPromocion.count({ where }))
      )
        throw new ConflictException(
          'El artículo tiene precios especiales relacionados',
        );
    }
    if (t.nombre === 'tbl_ospp') {
      const detalle = { ...where, cardCode: fila.cardCode as string };
      if (
        (await tx.precioEspecialDetalle.count({
          where: { ...detalle, listNum: fila.listPriceCod as number },
        })) ||
        (await tx.precioEspecialPromocion.count({ where: detalle }))
      )
        throw new ConflictException(
          'El precio especial tiene líneas o promociones relacionadas',
        );
    }
    if (
      t.nombre === 'tbl_spp1' &&
      (await tx.precioEspecialPromocion.count({
        where: {
          ...where,
          cardCode: fila.cardCode as string,
          spp1Lnum: fila.lineNum as number,
        },
      }))
    )
      throw new ConflictException('La línea tiene promociones relacionadas');
  }
  async editar(
    t: TablaProductos,
    empresaId: number,
    clave: Record<string, unknown>,
    datos: Record<string, unknown>,
    usuarioId?: number,
  ) {
    await this.acceso(t, empresaId, usuarioId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Las claves se modifican bajo bloqueo de empresa, igual que las eliminaciones.
        await tx.$queryRaw`SELECT id FROM empresas WHERE id=${empresaId} FOR UPDATE`;
        const m = this.modelo(tx, t);
        const where = filtroClaveTabla(t, empresaId, clave);
        const fila = await m.findFirst({ where, select: seleccionTabla(t) });
        if (!fila)
          throw new NotFoundException('Registro no disponible en esta empresa');
        if (
          t.clave.some(
            (c) => datos[c] !== undefined && datos[c] !== fila[t.columnas[c]],
          )
        )
          await this.proteger(tx, t, empresaId, fila);
        return salidaTabla(
          t,
          await m.update({
            where: { ...where, id: fila.id },
            data: entradaTabla(t, datos),
            select: seleccionTabla(t),
          }),
        );
      });
    } catch (e: unknown) {
      errorTabla(e);
    }
  }
  async eliminar(
    t: TablaProductos,
    empresaId: number,
    clave: Record<string, unknown>,
    usuarioId?: number,
  ) {
    await this.acceso(t, empresaId, usuarioId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM empresas WHERE id=${empresaId} FOR UPDATE`;
        const m = this.modelo(tx, t);
        const where = filtroClaveTabla(t, empresaId, clave);
        const fila = await m.findFirst({ where, select: seleccionTabla(t) });
        if (!fila)
          throw new NotFoundException('Registro no disponible en esta empresa');
        await this.proteger(tx, t, empresaId, fila);
        await m.delete({
          where: { ...where, id: fila.id },
          select: { id: true },
        });
        return { ok: true };
      });
    } catch (e: unknown) {
      errorTabla(e);
    }
  }
}
