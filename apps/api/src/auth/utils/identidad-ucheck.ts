import type { IdentidadUcheckCanjeada } from '../interfaces/identidad-ucheck.interface';

export function esIdentidadUcheck(
  valor: unknown,
): valor is IdentidadUcheckCanjeada {
  if (!valor || typeof valor !== 'object') return false;
  const identidad = valor as Partial<IdentidadUcheckCanjeada>;
  return (
    Number.isSafeInteger(identidad.usuarioId) &&
    (identidad.usuarioId ?? 0) > 0 &&
    typeof identidad.correo === 'string' &&
    identidad.correo.length > 3 &&
    typeof identidad.nombre === 'string' &&
    typeof identidad.destino === 'string'
  );
}
