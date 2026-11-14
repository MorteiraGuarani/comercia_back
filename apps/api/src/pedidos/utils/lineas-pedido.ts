import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

/**
 * Pestañas del asistente de pedidos. Salen de campo_categoria: cada categoría
 * Modo I con grupo de OITB es una pestaña propia, en su orden; el resto de los
 * grupos (Modo G, sin categoría o sin grupo) va en «Otros», siempre al final.
 */
export interface LineaPedidoConfig {
  /** Id de campo_categoria, o «resto» para Otros. Se guarda en pedido_lineas.linea. */
  id: string;
  nombre: string;
  /** tbl_oitb.Number (OITM.ItemsGroupCode); null en Otros. */
  grupo: number | null;
}

export type LineaPedido = string;

/** Id fijo de «Otros»: es el que ya tienen los pedidos guardados como «Resto». */
export const LINEA_OTROS = 'resto';

export interface CategoriaLinea {
  id: number;
  nombre_categoria: string;
  ItemGroupCode: number | null;
  Modo: string | null;
}

/** Las categorías llegan ordenadas por orden e id. */
export function armarLineas(categorias: CategoriaLinea[]): LineaPedidoConfig[] {
  const usados = new Set<number>();
  const propias: LineaPedidoConfig[] = [];
  for (const c of categorias) {
    if (c.Modo?.trim().toUpperCase() !== 'I' || c.ItemGroupCode === null)
      continue;
    // Un grupo repetido queda en la primera pestaña que lo nombra.
    if (usados.has(c.ItemGroupCode)) continue;
    usados.add(c.ItemGroupCode);
    propias.push({
      id: String(c.id),
      nombre: c.nombre_categoria.trim(),
      grupo: c.ItemGroupCode,
    });
  }
  return [...propias, { id: LINEA_OTROS, nombre: 'Otros', grupo: null }];
}

export function whereLinea(
  lineas: LineaPedidoConfig[],
  linea: LineaPedido,
): Prisma.ProductoWhereInput {
  const elegida = lineas.find((l) => l.id === linea);
  if (!elegida) throw new BadRequestException('Línea de productos inválida');
  if (elegida.grupo !== null) return { itmsgrpcode: elegida.grupo };
  const propios = lineas.flatMap((l) => (l.grupo === null ? [] : [l.grupo]));
  return propios.length
    ? { OR: [{ itmsgrpcode: null }, { itmsgrpcode: { notIn: propios } }] }
    : {};
}

export function lineaDeGrupo(
  lineas: LineaPedidoConfig[],
  grupo: Prisma.Decimal | number | null,
): LineaPedido {
  const numero = grupo === null ? Number.NaN : Number(grupo);
  return lineas.find((l) => l.grupo === numero)?.id ?? LINEA_OTROS;
}
