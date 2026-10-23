"use client";
import Dexie, { type Table } from "dexie";
import { apiFetch, ApiError } from "./api";
import type { PingPendiente, RespuestaPings } from "@/types/ubicacion";

// Unas dos jornadas a un punto por minuto; lo más viejo se descarta primero.
const MAX_PENDIENTES = 1500;
const POR_LOTE = 50;

class BaseUbicaciones extends Dexie {
  pendientes!: Table<PingPendiente, number>;

  constructor() {
    super("comercia-ubicaciones");
    this.version(1).stores({ pendientes: "++id, usuarioId" });
  }
}

// Se abre recién al usarla: el módulo nunca toca IndexedDB en el servidor.
let base: BaseUbicaciones | null = null;
const db = () => (base ??= new BaseUbicaciones());
const propios = (usuarioId: number) =>
  db().pendientes.where("usuarioId").equals(usuarioId);

export async function encolarPing(ping: PingPendiente) {
  await db().pendientes.add(ping);
  const sobran = (await propios(ping.usuarioId).count()) - MAX_PENDIENTES;
  if (sobran > 0) await propios(ping.usuarioId).limit(sobran).delete();
}

let enCurso: Promise<boolean | null> | null = null;

/**
 * Manda lo guardado en lotes. Devuelve si la jornada sigue activa, o null si
 * no había nada. Un error de red deja todo en la cola para el próximo intento.
 */
export function enviarPings(usuarioId: number): Promise<boolean | null> {
  enCurso ??= (async () => {
    try {
      // Con atraso acumulado se confirma la cuenta: nunca se le atribuyen a
      // otra persona los puntos que quedaron en un teléfono compartido.
      if ((await propios(usuarioId).count()) > 1) {
        const sesion = await apiFetch<{ usuario: { id: number } }>("/auth/me");
        if (sesion.usuario.id !== usuarioId) return null;
      }
      let activa: boolean | null = null;
      for (;;) {
        const lote = await propios(usuarioId).limit(POR_LOTE).toArray();
        if (!lote.length) return activa;
        try {
          const r = await apiFetch<RespuestaPings>("/campo/ubicaciones", {
            method: "POST",
            body: JSON.stringify({
              pings: lote.map((p) => ({
                latitud: p.latitud,
                longitud: p.longitud,
                precisionMetros: p.precisionMetros,
                velocidadMps: p.velocidadMps,
                rumboGrados: p.rumboGrados,
                capturadaEn: p.capturadaEn,
              })),
            }),
          });
          activa = r.activa;
        } catch (error) {
          // Un lote inválido nunca se va a aceptar: se descarta en vez de trabar la cola.
          if (!(error instanceof ApiError) || error.status !== 400) throw error;
        }
        await db().pendientes.bulkDelete(lote.map((p) => p.id!));
      }
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}
