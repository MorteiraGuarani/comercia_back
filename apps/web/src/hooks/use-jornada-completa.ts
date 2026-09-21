"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { RespuestaPaginada } from "@/types/paginacion";

export function useJornadaCompleta<T>(qsFecha: string, revision = 0) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [consultaTerminada, setConsultaTerminada] = useState("");
  const consulta = `${qsFecha}|${revision}|${recarga}`;

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const acumulado: T[] = [];
        let page = 1;
        let totalPages = 1;
        let totalRegistros = 0;
        do {
          const res = await apiFetch<RespuestaPaginada<T>>(
            `/campo/jornada?${qsFecha}&page=${page}&limit=50`,
          );
          acumulado.push(...res.items);
          totalPages = Math.max(1, res.totalPages);
          totalRegistros = res.total;
          page += 1;
        } while (page <= totalPages && page <= 20);
        if (!vigente) return;
        setItems(acumulado);
        setTotal(totalRegistros);
        setError(null);
      } catch (err) {
        if (!vigente) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los locales de la ruta",
        );
      } finally {
        if (vigente) setConsultaTerminada(consulta);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [qsFecha, revision, recarga, consulta]);

  const refrescar = useCallback(() => setRecarga((n) => n + 1), []);
  return {
    items,
    total,
    cargando: consultaTerminada !== consulta,
    error,
    refrescar,
  };
}
