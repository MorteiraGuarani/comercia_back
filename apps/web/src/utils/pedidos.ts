import type { EstadoPedido, LineaPedido } from "@/types/pedido";

/** Pasos de productos del pedido; los mismos ids que valida la API. */
export const LINEAS_PEDIDO: { id: LineaPedido; nombre: string }[] = [
  { id: "hamburguesas", nombre: "Hamburguesas" },
  { id: "embutidos", nombre: "Embutidos" },
  { id: "pollo", nombre: "Pollo" },
  { id: "resto", nombre: "Resto" },
];

export const ESTADOS_PEDIDO: { id: EstadoPedido; nombre: string }[] = [
  { id: "CARGADO", nombre: "Guardado" },
  { id: "MIGRADO", nombre: "Migrado" },
  { id: "FACTURADO", nombre: "Facturado" },
  { id: "ENTREGADO", nombre: "Entregado" },
];

// shortcut: usuarios de prueba fijos en código, espejo de la API; pasar a Acceso por empresa al habilitar Pedidos.
const USUARIOS_PRUEBA_PEDIDOS = new Set(["giselle.romero", "falmiron"]);

/** Pedidos en pruebas: Admin TI y los usuarios de prueba (la API decide igual). */
export function puedeUsarPedidos(u: { esAdminTi: boolean; nombreLogin: string }): boolean {
  return u.esAdminTi || USUARIOS_PRUEBA_PEDIDOS.has(u.nombreLogin.toLowerCase());
}

export function guaranies(valor: number): string {
  return `Gs. ${Math.round(valor).toLocaleString("es-PY")}`;
}