"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { RespuestaPaginada } from "@/types/paginacion";

interface ProgramaUcheck {
  id: string;
  nombre: string;
}

/**
 * Programas de Ucheck del usuario: se eligen acá, Comercia guarda la copia y
 * se los asigna también en Ucheck.
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

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-[13px] font-semibold text-foreground">
        Programas asignados (Ucheck)
      </legend>
      {error ? (
        <p className="text-sm text-muted">
          {error}. Los programas quedan como están.
        </p>
      ) : !programas ? (
        <p className="text-sm text-muted">Cargando programas…</p>
      ) : programas.length === 0 ? (
        <p className="text-sm text-muted">
          La empresa no tiene programas habilitados en Ucheck.
        </p>
      ) : (
        <div className="grid gap-x-4 sm:grid-cols-2">
          {programas.map((programa) => (
            <label
              key={programa.id}
              className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={value.includes(programa.id)}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, programa.id]
                      : value.filter((codigo) => codigo !== programa.id),
                  )
                }
              />
              {programa.nombre}
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        Se asignan también en Ucheck. En el alta, sin elegir ninguno se usan
        los de su rol de campo.
      </p>
    </fieldset>
  );
}
