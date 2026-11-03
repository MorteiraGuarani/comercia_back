"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { RespuestaPaginada } from "@/types/paginacion";
import { inputBase, labelBase } from "@/components/ui";

interface ProgramaUcheck {
  id: string;
  nombre: string;
}

/**
 * Programa de Ucheck del usuario: se elige uno acá, Comercia guarda la copia y
 * se lo asigna también en Ucheck (reemplaza a los que tenía).
 */
export function ProgramasUcheck({
  url,
  value,
  onChange,
  disabled,
}: {
  url: string;
  value: string[];
  onChange: (codigos: string[]) => void;
  disabled?: boolean;
}) {
  const [programas, setProgramas] = useState<ProgramaUcheck[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    // shortcut: una sola página de 50 (el tope del API); con más programas, paginar la lista.
    void apiFetch<RespuestaPaginada<ProgramaUcheck>>(
      `${url}${url.includes("?") ? "&" : "?"}page=1&limit=50`,
    )
      .then((r) => {
        if (vigente) {
          setProgramas(r.items);
          setError("");
        }
      })
      .catch((e) => {
        if (vigente)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron traer los programas de Ucheck",
          );
      });
    return () => {
      vigente = false;
    };
  }, [url]);

  const elegido = value[0] ?? "";
  return (
    <div className="min-w-0 space-y-2">
      {error ? (
        <p className="text-sm text-muted">
          {error}. El programa queda como está.
        </p>
      ) : !programas ? (
        <p className="text-sm text-muted">Cargando programas…</p>
      ) : (
        <label className={labelBase}>
          Programa asignado (Ucheck)
          <select
            value={elegido}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
            className={`${inputBase} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="">Sin programa</option>
            {elegido && !programas.some((p) => p.id === elegido) ? (
              <option value={elegido}>{elegido}</option>
            ) : null}
            {programas.map((programa) => (
              <option key={programa.id} value={programa.id}>
                {programa.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-xs text-muted">
        {value.length > 1
          ? `En Ucheck tiene ${value.length} programas; elegir otro deja solo ese. `
          : ""}
        Se asigna también en Ucheck. En el alta, sin elegir ninguno se usan los
        de su rol de campo.
      </p>
    </div>
  );
}
