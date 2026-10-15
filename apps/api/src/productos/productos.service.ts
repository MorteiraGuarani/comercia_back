import {
  ConflictException,
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
import {
  PRODUCTOS_POR_BLOQUE,
  TIMEOUT_LOTE_PRODUCTOS_MS,
} from './productos.constants';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  // Precios especiales conserva su autorización; el catálogo público solo
  // comprueba la empresa y los datos de la operación.
  async autorizar(usuarioId: number, empresaId?: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, esSuperadmin: true, isActive: true },
      select: { id: true },
    });
    if (!usuario)
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

  async productos(
    empresaId: number,
    query: ConsultaCatalogoDto,
    opciones = false,
  ) {
    await this.comprobarEmpresa(empresaId);
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

  async crearProducto(empresaId: number, dto: CrearProductoDto) {
    await this.comprobarEmpresa(empresaId);
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

  async crearProductos(empresaId: number, dtos: CrearProductoDto[]) {
    await this.comprobarEmpresa(empresaId);
    const claves = dtos.map((d) => JSON.stringify([d.itemcode, d.pricelist]));
    const vistas = new Set<string>();
    for (const [index, clave] of claves.entries()) {
      if (vistas.has(clave))
        throw new ConflictException({
          statusCode: 409,
          message: `Fila ${index + 1}: itemcode y pricelist repetidos dentro del lote`,
          index,
          itemcode: dtos[index].itemcode,
          pricelist: dtos[index].pricelist,
        });
      vistas.add(clave);
    }
    let inicioBloque = 0;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const porClave = new Map<
            string,
            ReturnType<typeof productoRespuesta>
          >();
          for (
            inicioBloque = 0;
            inicioBloque < dtos.length;
            inicioBloque += PRODUCTOS_POR_BLOQUE
          ) {
            const bloque = dtos.slice(
              inicioBloque,
              inicioBloque + PRODUCTOS_POR_BLOQUE,
            );
            const filas = await tx.producto.createManyAndReturn({
              data: bloque.map((dto) => ({ ...dto, empresaId })),
              select: PRODUCTO_SELECT,
            });
            // El orden de RETURNING puede diferir del de entrada.
            for (const fila of filas)
              porClave.set(
                JSON.stringify([fila.itemcode, fila.pricelist]),
                productoRespuesta(fila),
              );
          }
          return claves.map((clave) => porClave.get(clave)!);
        },
        { maxWait: 5_000, timeout: TIMEOUT_LOTE_PRODUCTOS_MS },
      );
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        // La transacción ya se revirtió. Consultar solo el bloque que falló
        // evita generar un OR de decenas de miles de condiciones.
        const bloque = dtos.slice(
          inicioBloque,
          inicioBloque + PRODUCTOS_POR_BLOQUE,
        );
        const existentes = await this.prisma.producto.findMany({
          where: {
            empresaId,
            OR: bloque.map(({ itemcode, pricelist }) => ({
              itemcode,
              pricelist,
            })),
          },
          select: { itemcode: true, pricelist: true },
          take: bloque.length,
        });
        const ocupadas = new Set(
          existentes.map((fila) =>
            JSON.stringify([fila.itemcode, fila.pricelist]),
          ),
        );
        const posicion = claves
          .slice(inicioBloque, inicioBloque + PRODUCTOS_POR_BLOQUE)
          .findIndex((clave) => ocupadas.has(clave));
        if (posicion !== -1) {
          const index = inicioBloque + posicion;
          throw new ConflictException({
            statusCode: 409,
            message: `Fila ${index + 1}: ya existe itemcode "${dtos[index].itemcode}" con pricelist ${dtos[index].pricelist} en la empresa`,
            index,
            itemcode: dtos[index].itemcode,
            pricelist: dtos[index].pricelist,
          });
        }
      }
      errorCatalogo(error, 'El lote contiene un identificador duplicado');
    }
  }

  async editarProducto(empresaId: number, id: string, dto: DatosProductoDto) {
    await this.comprobarEmpresa(empresaId);
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

  async eliminarProducto(empresaId: number, id: string) {
    await this.comprobarEmpresa(empresaId);
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
