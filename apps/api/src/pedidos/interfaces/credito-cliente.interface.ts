/** Fila de FG_PROD.SP_ESTADO_CREDITO_CLIENTES (una por moneda). */
export interface FilaEstadoCredito {
  CodigoCliente: string;
  Moneda: string;
  CantidadFacturasPendientes: number;
  MontoTotalPendiente: string;
  Estado: 'HABILITADO' | 'INHABILITADO';
  MotivoInhabilitado: string;
  FechaFacturaInhabilitante: string | null;
}

/** Estado de crédito del cliente en SAP para cargarle un pedido. */
export interface CreditoCliente {
  habilitado: boolean;
  motivo: string;
  facturasPendientes: number;
  /** Saldo pendiente por moneda, ya formateado por SAP ("Gs. 0"). */
  montosPendientes: string[];
  fechaFacturaInhabilitante: string | null;
}
