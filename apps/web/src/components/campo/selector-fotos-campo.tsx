"use client";

import { useRef, useState } from "react";
import { prepararImagen } from "@/utils/preparar-imagen";
import { PantallaCarga } from "@/components/pantalla-carga";
import { CapturadorCamara } from "./capturador-camara";
import { IconoCamara, IconoGaleria } from "./ui/iconos-campo";

const MAX_FOTOS = 5;

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
  const [procesando, setProcesando] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  const seleccionar = async (seleccionados: FileList | File[] | null) => {
    if (!seleccionados) return;
    const nuevos = Array.from(seleccionados);
    if (archivos.length + nuevos.length > MAX_FOTOS) {
      setError(`Podés adjuntar hasta ${MAX_FOTOS} fotos.`);
      return;
    }
    setProcesando(true);
    setError("");
    try {
      const preparadas: File[] = [];
      for (const archivo of nuevos) preparadas.push(await prepararImagen(archivo));
      onChange([...archivos, ...preparadas]);
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : "No se pudieron procesar las fotos.");
    } finally {
      setProcesando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <PantallaCarga visible={procesando} mensaje="Preparando fotos" />
      {camaraAbierta && <CapturadorCamara onCapturar={(archivo) => void seleccionar([archivo])} onCerrar={() => setCamaraAbierta(false)} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Fotos (opcional)
          </p>
          <p className="text-[11px] text-muted">
            Hasta 5 fotos; se reducen antes de subir.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={disabled || procesando || archivos.length >= MAX_FOTOS}
          onChange={(evento) => void seleccionar(evento.target.files)}
          className="sr-only"
          tabIndex={-1}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-label="Elegir fotos de la galería" title="Galería" disabled={disabled || procesando || archivos.length >= MAX_FOTOS} onClick={() => inputRef.current?.click()} className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface-raised text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-50"><IconoGaleria className="h-5 w-5" /></button>
          <button type="button" aria-label="Tomar foto con la cámara" title="Cámara" disabled={disabled || procesando || archivos.length >= MAX_FOTOS} onClick={() => setCamaraAbierta(true)} className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface-raised text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-50"><IconoCamara className="h-5 w-5" /></button>
        </div>
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
