import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import type { CatalogoInventario } from './interfaces/item-inventario.interface';
import {
  aItemInventario,
  SELECT_ITEM_INVENTARIO,
} from './utils/item-inventario';
import {
  LIMITE_ITEMS_INVENTARIO,
  MODULO_INVENTARIO,
  PAGINA_INVENTARIO,
} from './inventario.constants';

@Injectable()
export class InventarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plataforma: AccesoPlataformaService,
  ) {}

  // Precios de tbl_itm1 con el nombre oficial de tbl_oitm: un artículo aparece
  // una vez por cada lista de precios. La empresa sale de la sesión, nunca de
  // la consulta.
  async listarItems(usuarioId: number): Promise<CatalogoInventario> {
    const { empresaId } = await this.plataforma.exigirAccesoPagina(
      usuarioId,
      MODULO_INVENTARIO,
      PAGINA_INVENTARIO,
    );
    const filas = await this.prisma.productoPrecio.findMany({
      where: { empresaId },
      select: SELECT_ITEM_INVENTARIO,
      orderBy: [{ itemcode: 'asc' }, { pricelist: 'asc' }],
      take: LIMITE_ITEMS_INVENTARIO + 1,
    });
    // Nunca se entrega un catálogo truncado: el navegador lo tomaría por completo.
    if (filas.length > LIMITE_ITEMS_INVENTARIO)
      throw new PayloadTooLargeException(
        'El catálogo de artículos supera el máximo que se puede guardar en el equipo',
      );
    const codigos = [...new Set(filas.map((f) => f.pricelist))];
    const listas = codigos.length
      ? await this.prisma.socioNegocioListaPrecio.findMany({
          where: { empresaId, ListNum: { in: codigos } },
          select: { ListNum: true, ListName: true },
          take: codigos.length,
        })
      : [];
    const nombres = new Map(listas.map((l) => [l.ListNum!, l.ListName]));
    return {
      items: filas.map((f) =>
        aItemInventario(f, nombres.get(f.pricelist) ?? null),
      ),
      total: filas.length,
    };
  }
}
