import type {
  ConfirmacionPendiente,
  PedidoConfirmacion,
} from "@/types/confirmacion";

type Oyente = (pedido: ConfirmacionPendiente) => void;
let oyente: Oyente | null = null;

export function registrarHostConfirmacion(nuevo: Oyente) {
  oyente = nuevo;
  return () => {
    if (oyente === nuevo) oyente = null;
  };
}

/**
 * Reemplazo de window.confirm con el modal de la app. Resuelve true si la
 * persona confirma y false si cancela o cierra. Sin host montado (no debería
 * pasar) cae en el confirm del navegador para no perder la pregunta.
 */
export function confirmar(pedido: PedidoConfirmacion): Promise<boolean> {
  if (!oyente) return Promise.resolve(window.confirm(pedido.mensaje));
  const actual = oyente;
  return new Promise((resolve) => actual({ ...pedido, responder: resolve }));
}
