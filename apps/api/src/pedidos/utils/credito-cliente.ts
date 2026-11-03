import type {
  CreditoCliente,
  FilaEstadoCredito,
} from '../interfaces/credito-cliente.interface';

/** Une las filas por moneda del SP: inhabilitado si alguna lo está. */
export function aCreditoCliente(filas: FilaEstadoCredito[]): CreditoCliente {
  const bloqueante = filas.find((f) => f.Estado === 'INHABILITADO');
  return {
    habilitado: !bloqueante,
    motivo: bloqueante?.MotivoInhabilitado ?? '',
    facturasPendientes: filas.reduce(
      (suma, f) => suma + Number(f.CantidadFacturasPendientes || 0),
      0,
    ),
    montosPendientes: filas.map((f) => f.MontoTotalPendiente),
    fechaFacturaInhabilitante: bloqueante?.FechaFacturaInhabilitante ?? null,
  };
}
