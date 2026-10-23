import { metrosEntre } from "./distancia";

/** Quieto en el mismo lugar alcanza con un punto cada 5 minutos. */
const METROS_MOVIMIENTO = 25;
const MS_QUIETO = 5 * 60_000;
/** Sin noticias hace más que esto, el punto del mapa en vivo se ve apagado. */
export const MINUTOS_SIN_SENAL = 15;

export function debeGuardarPing(
  anterior: { latitud: number; longitud: number; momento: number } | null,
  actual: { latitud: number; longitud: number; momento: number },
): boolean {
  return (
    !anterior ||
    actual.momento - anterior.momento >= MS_QUIETO ||
    metrosEntre(anterior, actual) >= METROS_MOVIMIENTO
  );
}

export function minutosDesde(iso: string, ahora = Date.now()): number {
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60_000));
}

export function textoHace(iso: string, ahora = Date.now()): string {
  const min = minutosDesde(iso, ahora);
  if (min < 1) return "Recién";
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  return `Hace ${horas} h ${min % 60} min`;
}

export function textoVelocidad(mps: number | null): string | null {
  return mps === null || mps < 0.5 ? null : `${Math.round(mps * 3.6)} km/h`;
}
