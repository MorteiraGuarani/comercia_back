import { Decimal } from '@prisma/client/runtime/client';
import { BadRequestException } from '@nestjs/common';
import type { TablaProductos } from '../interfaces/tabla-productos.interface';
import type { RegistroTabla } from '../../common/interfaces/repositorio-tabla.interface';

export function seleccionTabla(t: TablaProductos) {
  return Object.fromEntries(
    ['id', ...Object.values(t.columnas)].map((c) => [c, true]),
  );
}
export function entradaTabla(
  t: TablaProductos,
  datos: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(t.columnas)
      .filter(([c]) => datos[c] !== undefined)
      .map(([c, interno]) => [interno, datos[c]]),
  );
}
export function salidaTabla(t: TablaProductos, fila: RegistroTabla) {
  return {
    id: fila.id.toString(),
    ...Object.fromEntries(
      Object.entries(t.columnas).map(([campo, interno]) => {
        const valor = fila[interno] ?? null;
        return [campo, Decimal.isDecimal(valor) ? valor.toFixed(6) : valor];
      }),
    ),
  };
}
export function claveTabla(t: TablaProductos, fila: Record<string, unknown>) {
  return JSON.stringify(t.clave.map((c) => fila[c]));
}

export function filtroClaveTabla(
  t: TablaProductos,
  empresaId: number,
  clave: Record<string, unknown>,
) {
  if (t.clave.some((c) => clave[c] === undefined || clave[c] === null))
    throw new BadRequestException('Se requiere la clave de negocio completa');
  return {
    empresaId,
    ...entradaTabla(t, Object.fromEntries(t.clave.map((c) => [c, clave[c]]))),
  };
}
