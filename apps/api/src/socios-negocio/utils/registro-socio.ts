import { MAX_INT4, MIN_INT4 } from '../../common/utils/numeros';
import type { TablaSociosDefinicion } from '../interfaces/tabla-socios.interface';
import type {
  EntradaSocio,
  RegistroSocio,
} from '../interfaces/registro-socio.interface';

export function seleccionSocios(tabla: TablaSociosDefinicion) {
  return Object.fromEntries(
    ['id', ...tabla.campos].map((campo) => [campo, true]),
  );
}
export function respuestaSocios(
  tabla: TablaSociosDefinicion,
  fila: RegistroSocio,
) {
  return {
    id: fila.id.toString(),
    ...Object.fromEntries(
      tabla.campos.map((campo) => [campo, fila[campo] ?? null]),
    ),
  };
}
export function claveSocios(tabla: TablaSociosDefinicion, fila: EntradaSocio) {
  if (tabla.identidad && fila[tabla.identidad] === undefined) return null;
  return JSON.stringify(
    tabla.clave.map((campo) =>
      fila[campo] !== undefined
        ? fila[campo]
        : (tabla.predeterminados[campo] ?? null),
    ),
  );
}
export function codigoCanalSocio(valor: unknown): number | null {
  return typeof valor === 'string' &&
    /^-?\d+$/.test(valor) &&
    Number.isSafeInteger(Number(valor)) &&
    Number(valor) >= MIN_INT4 &&
    Number(valor) <= MAX_INT4
    ? Number(valor)
    : null;
}
