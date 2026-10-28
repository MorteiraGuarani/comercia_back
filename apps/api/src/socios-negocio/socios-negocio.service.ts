import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LoteValidado } from '../common/interfaces/error-validacion.interface';
import { comoLote, resumenInvalidas } from '../common/utils/errores-validacion';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { MAX_INT4 } from '../common/utils/numeros';
import { ConsultaSociosDto } from './dto/consulta-socios.dto';
import type { TablaSociosDefinicion } from './interfaces/tabla-socios.interface';
import type {
  EntradaSocio,
  RegistroSocio,
} from './interfaces/registro-socio.interface';
import type { RepositorioSocios } from './interfaces/repositorio-socios.interface';
import {
  TABLAS_SOCIOS,
  SOCIOS_POR_BLOQUE,
  TIMEOUT_LOTE_SOCIOS_MS,
} from './tablas-socios';
import {
  seleccionSocios,
  respuestaSocios,
  claveSocios,
  codigoCanalSocio,
} from './utils/registro-socio';
import { filtroRegistroSocios } from './utils/filtro-registro';
import type { ConsultaDireccion } from './interfaces/consulta-direccion.interface';
import { errorSocios } from './utils/error-socios';

@Injectable()
export class SociosNegocioService {
  constructor(private readonly prisma: PrismaService) {}

  private modelo(
    tx: Prisma.TransactionClient,
    tabla: TablaSociosDefinicion,
  ): RepositorioSocios {
    return tx[tabla.modelo] as unknown as RepositorioSocios;
  }
  private async empresa(empresaId: number) {
    if (
      !(await this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Empresa no disponible');
  }
  private async bloquearEmpresa(
    tx: Prisma.TransactionClient,
    empresaId: number,
  ) {
    // Serializa códigos automáticos y modificaciones de referencias en la misma empresa.
    const filas = await tx.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM empresas WHERE id = ${empresaId} FOR UPDATE`;
    if (!filas.length) throw new NotFoundException('Empresa no disponible');
  }

  async listar(
    tabla: TablaSociosDefinicion,
    empresaId: number,
    query: ConsultaSociosDto,
    filtro: EntradaSocio = {},
  ) {
    await this.empresa(empresaId);
    const busquedas: EntradaSocio[] = [];
    if (query.buscar) {
      busquedas.push(
        ...tabla.busqueda.map((campo) => ({
          [campo]: { contains: query.buscar, mode: 'insensitive' },
        })),
      );
      const numero = Number(query.buscar);
      if (
        /^-?\d+$/.test(query.buscar) &&
        Number.isSafeInteger(numero) &&
        numero >= -2147483648 &&
        numero <= MAX_INT4
      )
        busquedas.push(
          ...tabla.clave
            .filter((campo) => !tabla.busqueda.includes(campo))
            .map((campo) => ({ [campo]: numero })),
        );
    }
    const where = {
      ...filtro,
      empresaId,
      ...(busquedas.length ? { OR: busquedas } : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const modelo = this.modelo(this.prisma, tabla);
    const [total, filas] = await Promise.all([
      modelo.count({ where }),
      modelo.findMany({
        where,
        select: seleccionSocios(tabla),
        skip,
        take,
        orderBy: { id: 'asc' },
      }),
    ]);
    return respuestaPaginada(
      filas.map((fila) => respuestaSocios(tabla, fila)),
      total,
      page,
      limit,
    );
  }
  private async fila(
    tabla: TablaSociosDefinicion,
    empresaId: number,
    id: string | number,
  ) {
    const fila = await this.modelo(this.prisma, tabla).findFirst({
      where: filtroRegistroSocios(tabla, empresaId, id),
      select: seleccionSocios(tabla),
    });
    if (!fila)
      throw new NotFoundException('Registro no disponible en esta empresa');
    return fila;
  }
  async obtener(
    tabla: TablaSociosDefinicion,
    empresaId: number,
    id: string | number,
    query: ConsultaDireccion = {},
  ) {
    if (tabla.nombre === 'tbl_crd1' || tabla.nombre === 'tbl_oscn')
      return this.listar(
        tabla,
        empresaId,
        query,
        filtroRegistroSocios(
          tabla,
          empresaId,
          id,
          tabla.nombre === 'tbl_oscn' ? query.articulo : query.direccion,
        ),
      );
    await this.empresa(empresaId);
    return respuestaSocios(tabla, await this.fila(tabla, empresaId, id));
  }

  async crear(
    tabla: TablaSociosDefinicion,
    empresaId: number,
    datos: EntradaSocio | EntradaSocio[] | LoteValidado,
  ) {
    const lote = comoLote(datos);
    const filas = lote
      ? (lote.filas as EntradaSocio[])
      : [datos as EntradaSocio];
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.bloquearEmpresa(tx, empresaId);
          const modelo = this.modelo(tx, tabla);
          const vistas = new Set<string>();
          const unicas = filas.filter((fila) => {
            const clave = claveSocios(tabla, fila);
            if (clave === null) return true;
            if (vistas.has(clave)) return false;
            vistas.add(clave);
            return true;
          });
          const entradas: EntradaSocio[] = unicas.map((fila) => ({
            ...fila,
            empresaId,
          }));
          if (
            tabla.identidad &&
            entradas.some((fila) => fila[tabla.identidad!] === undefined)
          ) {
            let ultimo = Math.max(
              0,
              (
                await modelo.aggregate({
                  where: { empresaId },
                  _max: { Code: true },
                })
              )._max.Code ?? 0,
            );
            for (const fila of entradas)
              if (typeof fila.Code === 'number')
                ultimo = Math.max(ultimo, fila.Code);
            for (const fila of entradas)
              if (fila.Code === undefined) {
                if (ultimo >= MAX_INT4)
                  throw new BadRequestException(
                    'No quedan códigos Code disponibles en esta empresa',
                  );
                fila.Code = ++ultimo;
              }
          }
          if (!lote)
            return respuestaSocios(
              tabla,
              await modelo.create({
                data: entradas[0],
                select: seleccionSocios(tabla),
              }),
            );
          let insertados = 0;
          for (
            let inicio = 0;
            inicio < entradas.length;
            inicio += SOCIOS_POR_BLOQUE
          ) {
            const resultado = await modelo.createMany({
              data: entradas.slice(inicio, inicio + SOCIOS_POR_BLOQUE),
              skipDuplicates: true,
            });
            insertados += resultado.count;
          }
          return {
            recibidos: lote.recibidos,
            insertados,
            existentes: unicas.length - insertados,
            duplicadosEnLote: filas.length - unicas.length,
            omitidos: filas.length - insertados,
            ...resumenInvalidas(lote.invalidas),
          };
        },
        { maxWait: 5_000, timeout: TIMEOUT_LOTE_SOCIOS_MS },
      );
    } catch (error: unknown) {
      errorSocios(error);
    }
  }

  private async protegerReferencias(
    tx: Prisma.TransactionClient,
    tabla: TablaSociosDefinicion,
    empresaId: number,
    fila: RegistroSocio,
  ) {
    const campo = tabla.clave[0];
    const valor = fila[campo];
    if (valor === null || valor === undefined) return;
    if (tabla.nombre === 'tbl_ocrd') {
      if (
        await this.modelo(tx, TABLAS_SOCIOS.tbl_crd1).count({
          where: { empresaId, CardCode: valor },
        })
      )
        throw new ConflictException(
          'El socio tiene direcciones asociadas; quitarlas o reasignarlas primero',
        );
      // El socio es el local de campo: sin esta comprobación el FK devolvería 404.
      const usoCampo = await tx.socioNegocio.findFirst({
        where: { empresaId, CardCode: valor as string },
        select: {
          _count: {
            select: {
              asignaciones: true,
              horarios: true,
              visitas: true,
              tareas: true,
              novedades: true,
              eventosUcheck: true,
              usuariosPrincipal: true,
              cargasInventario: true,
            },
          },
        },
      });
      if (usoCampo && Object.values(usoCampo._count).some((n) => n > 0))
        throw new ConflictException(
          'El socio tiene operación de campo asociada (asignaciones, horarios, visitas, tareas, novedades o inventario); quitarla primero',
        );
      return;
    }
    const referencias: Record<string, string> = {
      tbl_ocrg: 'GroupCode',
      tbl_octg: 'GroupNum',
      tbl_opln: 'ListNum',
      tbl_oagp: 'AgentCode',
      tbl_oslp: 'SlpCode',
      tbl_jcanales: 'U_jCANAL',
      tbl_jsubcanales: 'U_jSUBCANAL',
    };
    const referencia = referencias[tabla.nombre];
    if (referencia === 'U_jCANAL' || referencia === 'U_jSUBCANAL') {
      // Coincide con la resolución int4 de la consulta de relaciones: '001'
      // también referencia Code=1. Las columnas se eligen entre dos literales.
      const columna =
        referencia === 'U_jCANAL'
          ? Prisma.sql`"U_jCANAL"`
          : Prisma.sql`"U_jSUBCANAL"`;
      const usados = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
        SELECT id FROM tbl_ocrd WHERE empresa_id = ${empresaId}
        AND CASE WHEN ${columna} ~ '^-?[0-9]+$' THEN ${columna}::numeric END = ${Number(valor)}::numeric LIMIT 1
      `);
      if (usados.length)
        throw new ConflictException(
          'El código está relacionado con socios de negocio; reasignarlos primero',
        );
      return;
    }
    if (
      referencia &&
      (await this.modelo(tx, TABLAS_SOCIOS.tbl_ocrd).count({
        where: {
          empresaId,
          [referencia]: valor,
        },
      }))
    )
      throw new ConflictException(
        'El código está relacionado con socios de negocio; reasignarlos primero',
      );
  }
  private async registroParaModificar(
    tx: Prisma.TransactionClient,
    tabla: TablaSociosDefinicion,
    empresaId: number,
    referencia: string | number,
    direccion?: string,
  ) {
    const modelo = this.modelo(tx, tabla);
    const where = filtroRegistroSocios(tabla, empresaId, referencia, direccion);
    const filas =
      tabla.nombre === 'tbl_crd1' || tabla.nombre === 'tbl_oscn'
        ? await modelo.findMany({
            where,
            select: seleccionSocios(tabla),
            take: 2,
            orderBy: { id: 'asc' },
          })
        : [await modelo.findFirst({ where, select: seleccionSocios(tabla) })];
    if (!filas[0])
      throw new NotFoundException('Registro no disponible en esta empresa');
    if (filas.length > 1)
      throw new ConflictException(
        tabla.nombre === 'tbl_oscn'
          ? 'CardCode tiene varios artículos; indicar articulo con ItemCode y Substitute originales'
          : 'CardCode tiene varias direcciones; indicar direccion con Address, Street y AdresType originales',
      );
    return filas[0];
  }
  async editar(
    tabla: TablaSociosDefinicion,
    empresaId: number,
    id: string | number,
    datos: EntradaSocio,
    direccion?: string,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.bloquearEmpresa(tx, empresaId);
          const modelo = this.modelo(tx, tabla);
          const actual = await this.registroParaModificar(
            tx,
            tabla,
            empresaId,
            id,
            direccion,
          );
          if (
            tabla.clave.some(
              (campo) =>
                datos[campo] !== undefined && datos[campo] !== actual[campo],
            )
          )
            await this.protegerReferencias(tx, tabla, empresaId, actual);
          return respuestaSocios(
            tabla,
            await modelo.update({
              where: {
                id: actual.id,
                ...filtroRegistroSocios(tabla, empresaId, id, direccion),
              },
              data: datos,
              select: seleccionSocios(tabla),
            }),
          );
        },
        { maxWait: 5_000, timeout: TIMEOUT_LOTE_SOCIOS_MS },
      );
    } catch (error: unknown) {
      errorSocios(error);
    }
  }
  async eliminar(
    tabla: TablaSociosDefinicion,
    empresaId: number,
    id: string | number,
    direccion?: string,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.bloquearEmpresa(tx, empresaId);
          const modelo = this.modelo(tx, tabla);
          const actual = await this.registroParaModificar(
            tx,
            tabla,
            empresaId,
            id,
            direccion,
          );
          await this.protegerReferencias(tx, tabla, empresaId, actual);
          await modelo.delete({
            where: {
              id: actual.id,
              ...filtroRegistroSocios(tabla, empresaId, id, direccion),
            },
            select: { id: true },
          });
          return { ok: true };
        },
        { maxWait: 5_000, timeout: TIMEOUT_LOTE_SOCIOS_MS },
      );
    } catch (error: unknown) {
      errorSocios(error);
    }
  }

  async relaciones(empresaId: number, CardCode: string) {
    await this.empresa(empresaId);
    const socio = await this.fila(TABLAS_SOCIOS.tbl_ocrd, empresaId, CardCode);
    const resolver = async (
      tabla: TablaSociosDefinicion,
      campo: string,
      valor: unknown,
    ) => {
      if (valor === null || valor === undefined) return null;
      const fila = await this.modelo(this.prisma, tabla).findFirst({
        where: { empresaId, [campo]: valor },
        select: seleccionSocios(tabla),
      });
      return fila ? respuestaSocios(tabla, fila) : null;
    };
    const [
      tbl_ocrg,
      tbl_octg,
      tbl_opln,
      tbl_oagp,
      tbl_oslp,
      tbl_jcanales,
      tbl_jsubcanales,
    ] = await Promise.all([
      resolver(TABLAS_SOCIOS.tbl_ocrg, 'GroupCode', socio.GroupCode),
      resolver(TABLAS_SOCIOS.tbl_octg, 'GroupNum', socio.GroupNum),
      resolver(TABLAS_SOCIOS.tbl_opln, 'ListNum', socio.ListNum),
      resolver(TABLAS_SOCIOS.tbl_oagp, 'AgentCode', socio.AgentCode),
      resolver(TABLAS_SOCIOS.tbl_oslp, 'SlpCode', socio.SlpCode),
      resolver(
        TABLAS_SOCIOS.tbl_jcanales,
        'Code',
        codigoCanalSocio(socio.U_jCANAL),
      ),
      resolver(
        TABLAS_SOCIOS.tbl_jsubcanales,
        'Code',
        codigoCanalSocio(socio.U_jSUBCANAL),
      ),
    ]);
    return {
      tbl_ocrd: respuestaSocios(TABLAS_SOCIOS.tbl_ocrd, socio),
      tbl_ocrg,
      tbl_octg,
      tbl_opln,
      tbl_oagp,
      tbl_oslp,
      tbl_jcanales,
      tbl_jsubcanales,
    };
  }
  async direcciones(
    empresaId: number,
    CardCode: string,
    query: ConsultaSociosDto,
  ) {
    await this.empresa(empresaId);
    const socio = await this.fila(TABLAS_SOCIOS.tbl_ocrd, empresaId, CardCode);
    return this.listar(TABLAS_SOCIOS.tbl_crd1, empresaId, query, {
      CardCode: socio.CardCode,
    });
  }
}
