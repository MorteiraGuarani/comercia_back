export interface PedidoConfirmacion {
  titulo: string;
  mensaje: string;
  /** Texto del botón que confirma; por defecto "Confirmar". */
  textoConfirmar?: string;
  /** Acción destructiva: el botón se ve en rojo. */
  peligro?: boolean;
}

export interface ConfirmacionPendiente extends PedidoConfirmacion {
  responder: (aceptada: boolean) => void;
}
