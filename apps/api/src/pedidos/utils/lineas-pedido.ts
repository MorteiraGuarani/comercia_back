import type { Prisma } from '../../../generated/prisma/client';

/**
 * Pasos del asistente de pedidos: cada línea agrupa grupos de artículos de
 * OITM (ItemsGroupCode). "Otros" es todo lo que no entra en las anteriores.
 */
// shortcut: grupos fijos en código; pasarlos a una tabla de categorías cuando se definan las demás líneas.
export const LINEAS_PEDIDO = [
  { id: 'hamburguesas', nombre: 'Hamburguesas', grupos: [144] },
  { id: 'embutidos', nombre: 'Embutidos', grupos: [145] },
  { id: 'pollo', nombre: 'Pollo', grupos: [241] },
  { id: 'resto', nombre: 'Otros', grupos: [] },
] as const;

export type LineaPedido = (typeof LINEAS_PEDIDO)[number]['id'];
export const IDS_LINEAS_PEDIDO = LINEAS_PEDIDO.map((l) => l.id);

const AGRUPADOS: number[] = LINEAS_PEDIDO.flatMap((l) => [...l.grupos]);

export function whereLinea(linea: LineaPedido): Prisma.ProductoWhereInput {
  const grupos: readonly number[] = LINEAS_PEDIDO.find(
    (l) => l.id === linea,
  )!.grupos;
  return grupos.length
    ? { itmsgrpcode: { in: [...grupos] } }
    : { OR: [{ itmsgrpcode: null }, { itmsgrpcode: { notIn: AGRUPADOS } }] };
}

export function lineaDeGrupo(
  grupo: Prisma.Decimal | number | null,
): LineaPedido {
  return (
    LINEAS_PEDIDO.find((l) =>
      (l.grupos as readonly number[]).includes(
        grupo === null ? Number.NaN : Number(grupo),
      ),
    )?.id ?? 'resto'
  );
}
