import type { EstadoPedido, LineaPedido } from "@/types/pedido";

/** Pasos de productos del pedido; los mismos ids que valida la API. */
export const LINEAS_PEDIDO: { id: LineaPedido; nombre: string }[] = [
  { id: "hamburguesas", nombre: "Hamburguesas" },
  { id: "embutidos", nombre: "Embutidos" },
  { id: "pollo", nombre: "Pollo" },
  { id: "resto", nombre: "Resto" },
];

export const ESTADOS_PEDIDO: { id: EstadoPedido; nombre: string }[] = [
  { id: "CARGADO", nombre: "Cargado" },
  { id: "MIGRADO", nombre: "Migrado a SAP" },
  { id: "FACTURADO", nombre: "Facturado" },
  { id: "ENTREGADO", nombre: "Entregado" },
];

export function guaranies(valor: number): string {
  return `Gs. ${Math.round(valor).toLocaleString("es-PY")}`;
}
