"use client";

import { useRef, useState } from "react";
import { buscarLugares } from "@/lib/geocodificar";
import { coordenadasDeTexto, esLinkCortoMaps } from "@/utils/busqueda-lugar";
import { IconoBuscar, IconoPin } from "./iconos-campo";
import type { ResultadoLugar } from "@/types/mapa";

/**
 * Buscador "como en Google Maps" para los mapas: nombre de un lugar o una
 * dirección (OpenStreetMap), coordenadas o un link de Google Maps pegado.
 */
export function BuscadorLugarMapa({
  cerca,
  onElegir,
  placeholder = "Buscar lugar, dirección o pegar link de Google Maps",
}: {
  /** Centro del mapa visible: se priorizan los resultados cercanos. */
  cerca?: () => { latitud: number; longitud: number } | undefined;
  onElegir: (lugar: ResultadoLugar) => void;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoLugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const pedido = useRef<AbortController | null>(null);

  const elegir = (lugar: ResultadoLugar) => {
    setResultados(null);
    setAviso("");
    onElegir(lugar);
  };

  async function buscar() {
    const consulta = texto.trim();
    if (consulta.length < 2 || buscando) return;
    const coordenadas = coordenadasDeTexto(consulta);
    if (coordenadas) {
      elegir({
        nombre: "Coordenadas",
        detalle: `${coordenadas.latitud}, ${coordenadas.longitud}`,
        ...coordenadas,
      });
      return;
    }
    if (esLinkCortoMaps(consulta)) {
      setResultados(null);
      setAviso(
        "Los links cortos de Google Maps no traen la ubicación. Abrilo y copiá las coordenadas o el link largo.",
      );
      return;
    }
    pedido.current?.abort();
    const controlador = new AbortController();
    pedido.current = controlador;
    setBuscando(true);
    setAviso("");
    try {
      const lugares = await buscarLugares(consulta, {
        cerca: cerca?.(),
        signal: controlador.signal,
      });
      if (controlador.signal.aborted) return;
      setResultados(lugares);
      if (!lugares.length)
        setAviso(
          "Sin resultados en OpenStreetMap. Probá con la dirección, o pegá las coordenadas o el link de Google Maps.",
        );
    } catch (e) {
      if (!controlador.signal.aborted)
        setAviso(e instanceof Error ? e.message : "No se pudo buscar el lugar.");
    } finally {
      if (pedido.current === controlador) setBuscando(false);
    }
  }

  return (
    <div className="relative w-full min-w-0">
      <div
        role="search"
        aria-label="Buscar un lugar en el mapa"
        className="flex min-w-0 gap-1.5"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Lugar a buscar</span>
          <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (!e.target.value) {
                setResultados(null);
                setAviso("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void buscar();
              }
              if (e.key === "Escape") setResultados(null);
            }}
            placeholder={placeholder}
            maxLength={500}
            className="h-11 w-full min-w-0 rounded-lg border border-line bg-surface-raised pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>
        <button
          type="button"
          onClick={() => void buscar()}
          disabled={buscando || texto.trim().length < 2}
          className="min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {resultados && resultados.length > 0 ? (
        <ul
          aria-label="Lugares encontrados"
          className="absolute inset-x-0 top-full z-[1100] mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface-raised p-1 shadow-xl"
        >
          {resultados.map((lugar) => (
            <li key={`${lugar.latitud},${lugar.longitud},${lugar.nombre}`}>
              <button
                type="button"
                onClick={() => elegir(lugar)}
                className="flex min-h-11 w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <IconoPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {lugar.nombre}
                  </span>
                  {lugar.detalle ? (
                    <span className="block truncate text-xs text-muted">{lugar.detalle}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {aviso ? (
        <p role="status" className="mt-1.5 text-xs text-amber-800 dark:text-amber-200">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
