"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { RespuestaPaginada } from "@/types/paginacion";

export function useListaCampo<T>(url: string, revision = 0, limiteInicial = 25) {
  const [datos, setDatos] = useState<RespuestaPaginada<T> | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(limiteInicial);
  const [consultaTerminada, setConsultaTerminada] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const consulta = `${url}|${page}|${limit}|${revision}|${recarga}`;
  useEffect(() => {
    let vigente = true;
    apiFetch<RespuestaPaginada<T>>(
      `${url}${url.includes("?") ? "&" : "?"}page=${page}&limit=${limit}`,
    )
      .then((res) => {
        if (vigente) {
          if (page > res.totalPages) setPage(res.totalPages);
          setDatos(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (vigente)
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los datos",
          );
      })
      .finally(() => {
        if (vigente) setConsultaTerminada(consulta);
      });
    return () => {
      vigente = false;
    };
  }, [url, page, limit, consulta]);
  const refrescar = useCallback(() => setRecarga((n) => n + 1), []);
  return {
    page,
    limit,
    datos,
    items: datos?.items ?? [],
    cargando: consultaTerminada !== consulta,
    error,
    refrescar,
    setPage,
    setLimit: (n: number) => {
      setLimit(n);
      setPage(1);
    },
  };
}

export function useOperacionCampo() {
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);
  async function ejecutar(
    texto: string,
    operacion: () => Promise<unknown>,
  ): Promise<boolean> {
    if (enCurso.current) return false;
    enCurso.current = true;
    setMensaje(texto);
    setError(null);
    try {
      await operacion();
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo completar la operación",
      );
      return false;
    } finally {
      enCurso.current = false;
      setMensaje("");
    }
  }
  return { mensaje, error, ejecutar, limpiarError: () => setError(null) };
}
