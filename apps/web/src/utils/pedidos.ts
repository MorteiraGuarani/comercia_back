import type { EstadoPedido } from "@/types/pedido";

/** Id fijo de la pestaña «Otros» (lo que no tiene pestaña propia en Categorías). */
export const LINEA_OTROS = "resto";

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