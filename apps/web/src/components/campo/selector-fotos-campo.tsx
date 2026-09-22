"use client";

import { useRef, useState } from "react";

const MAX_FOTOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

export function SelectorFotosCampo({
  archivos,
  onChange,
  disabled = false,
}: {
  archivos: File[];
  onChange: (archivos: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const seleccionar = (seleccionados: FileList | null) => {
    if (!seleccionados) return;
    const nuevos = Array.from(seleccionados);
    const invalida = nuevos.find(
      (foto) => !TIPOS_PERMITIDOS.includes(foto.type) || foto.size > MAX_BYTES,
    );
    if (invalida) {
      setError("Cada foto debe ser JPG, PNG o WebP y pesar hasta 5 MB.");
      return;
    }
    if (archivos.length + nuevos.length > MAX_FOTOS) {
      setError(`Podés adjuntar hasta ${MAX_FOTOS} fotos.`);
      return;
    }
    setError("");
    onChange([...archivos, ...nuevos]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Fotos (opcional)
          </p>
          <p className="text-[11px] text-muted">
            Hasta 5 imágenes de 5 MB cada una.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || archivos.length >= MAX_FOTOS}
          onChange={(evento) => seleccionar(evento.target.files)}
          className="sr-only"
          tabIndex={-1}
        />
        <button
          type="button"
          disabled={disabled || archivos.length >= MAX_FOTOS}
          onClick={() => inputRef.current?.click()}
          className="min-h-11 rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Adjuntar foto
        </button>
      </div>

      {archivos.length > 0 && (
        <ul className="space-y-1" aria-label="Fotos seleccionadas">
          {archivos.map((archivo, indice) => (
            <li
              key={`${archivo.name}-${archivo.lastModified}-${indice}`}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-line bg-surface-soft px-3 py-1.5"
            >
              <span className="min-w-0 truncate text-xs text-foreground">
                {archivo.name}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(archivos.filter((_, i) => i !== indice))
                }
                className="min-h-11 shrink-0 px-2 text-xs font-semibold text-red-700 hover:underline dark:text-red-300"
                aria-label={`Quitar ${archivo.name}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
