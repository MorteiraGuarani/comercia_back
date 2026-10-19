"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { tareaCumplidaEnVisita } from "@/utils/tareas-campo";
import type { TareaJornadaCampo } from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";

/**
 * Avance de tareas de un local ("2/5"). Con visita abierta cuenta lo hecho en
 * esa visita; sin visita, lo hecho hoy. Solo consulta mientras `activo` (la
 * tarjeta abierta o con visita) para no pedir las tareas de toda la ruta.
 */
export function useResumenTareasLocal(
  asignacionId: number,
  qsFecha: string,
  visitaId: number | null,
  activo: boolean,
  revision = 0,
) {
  const [resumen, setResumen] = useState<{
    clave: string;
    hechas: number;
    total: number;
  } | null>(null);
  const clave = `${asignacionId}|${qsFecha}|${visitaId}|${revision}`;

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    // 50 es el máximo de la API; alcanza para las tareas de un local.
    apiFetch<RespuestaPaginada<TareaJornadaCampo>>(
      `/campo/jornada/asignaciones/${asignacionId}/tareas?${qsFecha}&page=1&limit=50`,
    )
      .then((r) => {
        if (!vigente) return;
        setResumen({
          clave,
          hechas: r.items.filter((t) =>
            tareaCumplidaEnVisita(t, visitaId ?? undefined),
          ).length,
          total: r.total,
        });
      })
      .catch(() => {
        if (vigente) setResumen(null);
      });
    return () => {
      vigente = false;
    };
  }, [asignacionId, qsFecha, visitaId, activo, clave]);

  return activo && resumen?.clave === clave ? resumen : null;
}
