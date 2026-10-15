import type {
  PrecioEspecialDetalleRespuestaDto,
  PrecioEspecialRespuestaDto,
} from '../dto/precio-especial.dto';
import type {
  PrecioEspecialDetalleFila,
  PrecioEspecialFila,
} from '../interfaces/precio-especial.interface';

// BIGSERIAL y NUMERIC(21,6) salen como texto: JSON no admite BigInt y un
// number de JavaScript redondearía los decimales.
function decimal(valor: { toFixed(digitos: number): string } | null) {
  return valor === null ? null : valor.toFixed(6);
}

export function precioEspecialRespuesta(
  fila: PrecioEspecialFila,
): PrecioEspecialRespuestaDto {
  return { ...fila, id: fila.id.toString(), price: decimal(fila.price) };
}

export function precioEspecialDetalleRespuesta(
  fila: PrecioEspecialDetalleFila,
): PrecioEspecialDetalleRespuestaDto {
  return {
    ...fila,
    id: fila.id.toString(),
    price: decimal(fila.price),
    discount: decimal(fila.discount),
  };
}
