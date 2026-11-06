import { ApiError, apiFetch } from "@/lib/api";
import type { MarcaRechazada, MarcaSinConexion } from "@/types/campo";
import { mensajeError } from "@/utils/error";

// Entradas y salidas que no llegaron a Ucheck (sin internet o Ucheck caído):
// quedan en este navegador con su hora y su GPS reales y se mandan solas
// cuando vuelve la conexión. Ucheck las guarda y Comercia trae la copia.

const clave = (usuarioId: number) => `comercia.marcas-sin-conexion.${usuarioId}`;
// Las rechazadas quedan aparte hasta que quien marcó lee el motivo.
const claveRechazadas = (usuarioId: number) => `comercia.marcas-rechazadas.${usuarioId}`;

/** Se dispara en `window` cada vez que cambia la lista guardada. */
export const EVENTO_MARCAS_SIN_CONEXION = "comercia:marcas-sin-conexion";

function leer<T>(k: string): T[] {
  try {
    const guardadas: unknown = JSON.parse(localStorage.getItem(k) ?? "[]");
    return Array.isArray(guardadas) ? (guardadas as T[]) : [];
  } catch {
    return [];
  }
}

export const leerMarcasSinConexion = (usuarioId: number) =>
  leer<MarcaSinConexion>(clave(usuarioId));

export const leerMarcasRechazadas = (usuarioId: number) =>
  leer<MarcaRechazada>(claveRechazadas(usuarioId));

function escribir(k: string, lista: unknown[]) {
  // Sin try: si el navegador no deja guardar, quien marca tiene que saberlo.
  localStorage.setItem(k, JSON.stringify(lista));
  window.dispatchEvent(new Event(EVENTO_MARCAS_SIN_CONEXION));
}

/** "Entendido": quien marcó ya leyó el motivo del rechazo. */
export function descartarMarcaRechazada(usuarioId: number, id: string) {
  escribir(
    claveRechazadas(usuarioId),
    leerMarcasRechazadas(usuarioId).filter((r) => r.marca.id !== id),
  );
}

const misma = (a: MarcaSinConexion, b: MarcaSinConexion) =>
  a.tipo === b.tipo &&
  a.asignacionId === b.asignacionId &&
  a.horarioId === b.horarioId &&
  a.fecha === b.fecha;

export function guardarMarcaSinConexion(usuarioId: number, marca: MarcaSinConexion) {
  const marcas = leerMarcasSinConexion(usuarioId);
  if (!marcas.some((m) => misma(m, marca))) escribir(clave(usuarioId), [...marcas, marca]);
}

/** Sin internet, o Comercia no llegó a Ucheck: la marca se guarda acá. */
export const esSinConexion = (e: unknown) =>
  e instanceof ApiError &&
  (e.status === 0 || e.status === 502 || e.status === 504 || e.codigo === "UCHECK_SIN_CONEXION");

// Solo estos son un "no" de Ucheck o Comercia (radio, horario, tareas…); con
// cualquier otro error la marca queda guardada para el próximo intento.
const esRechazo = (e: unknown) =>
  e instanceof ApiError && [400, 404, 409, 422].includes(e.status);

let enCurso: Promise<ResultadoEnvio> | null = null;

export interface ResultadoEnvio {
  enviadas: MarcaSinConexion[];
  rechazadas: MarcaRechazada[];
}

/** Manda en orden las marcas guardadas; con el primer corte deja el resto. */
export function enviarMarcasSinConexion(usuarioId: number): Promise<ResultadoEnvio> {
  enCurso ??= (async () => {
    const resultado: ResultadoEnvio = { enviadas: [], rechazadas: [] };
    for (const marca of leerMarcasSinConexion(usuarioId)) {
      try {
        await apiFetch("/campo/jornada/marcas-sin-conexion", {
          method: "POST",
          body: JSON.stringify({
            tipo: marca.tipo,
            asignacionId: marca.asignacionId,
            horarioId: marca.horarioId ?? undefined,
            fecha: marca.fecha,
            tomadaEn: marca.tomadaEn,
            ubicacion: marca.ubicacion,
            nota: marca.nota,
          }),
        });
        resultado.enviadas.push(marca);
      } catch (e) {
        if (!esRechazo(e)) break;
        const rechazada: MarcaRechazada = {
          marca,
          motivo: mensajeError(e, "Ucheck rechazó la marca"),
          rechazadaEn: new Date().toISOString(),
        };
        // Primero a rechazadas y recién después fuera de la cola: no se pierde sin aviso.
        escribir(claveRechazadas(usuarioId), [
          ...leerMarcasRechazadas(usuarioId).filter((r) => r.marca.id !== marca.id),
          rechazada,
        ]);
        resultado.rechazadas.push(rechazada);
      }
      escribir(
        clave(usuarioId),
        leerMarcasSinConexion(usuarioId).filter((m) => m.id !== marca.id),
      );
    }
    return resultado;
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}
