"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TOKENS } from "./tokens";
import { CAPA_MAPA_CLARA, CAPA_MAPA_OSCURA, useTemaOscuroMapa } from "./ui/use-tema-mapa";

export default function SelectorUbicacion({
  latitud,
  longitud,
  onChange,
}: {
  latitud: number;
  longitud: number;
  onChange: (latitud: number, longitud: number) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const cambiar = useRef(onChange);

  const [error, setError] = useState<string | null>(null);
  const [obteniendoGps, setObteniendoGps] = useState(false);
  const [gpsMensaje, setGpsMensaje] = useState<string | null>(null);
  const temaOscuro = useTemaOscuroMapa();

  useEffect(() => {
    cambiar.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!contenedor.current) return;

    // Coordenadas iniciales válidas o Asunción por defecto
    const latIni = Number.isFinite(latitud) && Math.abs(latitud) <= 90 ? latitud : -25.2969;
    const lngIni = Number.isFinite(longitud) && Math.abs(longitud) <= 180 ? longitud : -57.6415;

    const instancia = L.map(contenedor.current, {
      scrollWheelZoom: true,
      zoomControl: true,
      doubleClickZoom: true,
      touchZoom: true,
    }).setView([latIni, lngIni], 16);

    mapa.current = instancia;

    const tiles = L.tileLayer(temaOscuro ? CAPA_MAPA_OSCURA : CAPA_MAPA_CLARA, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(instancia);

    tiles.on("tileerror", () => {
      setError("No se pudo cargar el mapa base de OpenStreetMap.");
    });

    // Marcador con pin SVG editorial de alta visibilidad
    const pinHtml = `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);">
        <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#8B2635;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
          <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      className: "custom-map-pin",
      html: pinHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const punto = L.marker([latIni, lngIni], {
      draggable: true,
      title: "Arrastrá el pin o tocá el mapa para moverlo",
      icon: customIcon,
    }).addTo(instancia);

    marcador.current = punto;

    const elegir = (posicion: L.LatLng) => {
      const p = posicion.wrap();
      const nLat = Number(Math.max(-90, Math.min(90, p.lat)).toFixed(6));
      const nLng = Number(p.lng.toFixed(6));
      cambiar.current(nLat, nLng);
    };

    instancia.on("click", (e: L.LeafletMouseEvent) => {
      elegir(e.latlng);
      punto.setLatLng(e.latlng);
    });

    punto.on("dragend", () => {
      elegir(punto.getLatLng());
    });

    const observer = new ResizeObserver(() => instancia.invalidateSize());
    observer.observe(contenedor.current);

    return () => {
      observer.disconnect();
      instancia.remove();
      mapa.current = null;
      marcador.current = null;
    };
  }, [temaOscuro]);

  // Sincronizar marcador si las coordenadas cambian externamente
  useEffect(() => {
    if (
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud) ||
      Math.abs(latitud) > 90 ||
      Math.abs(longitud) > 180
    ) {
      return;
    }
    marcador.current?.setLatLng([latitud, longitud]);
  }, [latitud, longitud]);

  // Función para obtener la ubicación GPS actual del dispositivo
  const obtenerUbicacionActual = () => {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización GPS.");
      return;
    }

    setObteniendoGps(true);
    setError(null);
    setGpsMensaje("Detectando satélites GPS...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = Number(pos.coords.latitude.toFixed(6));
        const cLng = Number(pos.coords.longitude.toFixed(6));
        const precision = Math.round(pos.coords.accuracy);

        onChange(cLat, cLng);
        marcador.current?.setLatLng([cLat, cLng]);
        mapa.current?.flyTo([cLat, cLng], 17, { animate: true, duration: 1 });

        setGpsMensaje(`Ubicación detectada (precisión ±${precision}m)`);
        setObteniendoGps(false);
      },
      (err) => {
        setObteniendoGps(false);
        setGpsMensaje(null);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Permiso de ubicación denegado en tu navegador.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Información de ubicación no disponible.");
        } else if (err.code === err.TIMEOUT) {
          setError("Tiempo de espera agotado al obtener ubicación GPS.");
        } else {
          setError(`Error de geolocalización: ${err.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const reenfocarMarcador = () => {
    if (Number.isFinite(latitud) && Number.isFinite(longitud)) {
      mapa.current?.flyTo([latitud, longitud], 17, { animate: true, duration: 0.8 });
    }
  };

  return (
    <div className="space-y-2.5 font-sans">
      {/* Barra de ayuda e instrucciones */}
      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
        <p className="text-[#726C60]">
          Hacé clic en el mapa o arrastrá el pin. Podés usar la <b>rueda del ratón</b> o los botones para hacer zoom.
        </p>
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-100 border border-[#DAD5C9]">
          <span>Lat: {Number.isFinite(latitud) ? latitud.toFixed(5) : "—"}</span>
          <span className="text-zinc-400">|</span>
          <span>Lng: {Number.isFinite(longitud) ? longitud.toFixed(5) : "—"}</span>
        </div>
      </div>

      {/* Contenedor del mapa con controles superpuestos */}
      <div className="relative rounded-xl border border-[#DAD5C9] overflow-hidden shadow-inner bg-zinc-100">
        <div
          ref={contenedor}
          className="h-80 sm:h-96 w-full z-0 cursor-crosshair"
          aria-label="Mapa interactivo de ubicación"
        />

        {/* Botones de acción rápida flotantes sobre el mapa */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          {/* Botón Mi Ubicación Actual */}
          <button
            type="button"
            onClick={obtenerUbicacionActual}
            disabled={obteniendoGps}
            title="Centrar en mi ubicación GPS actual"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-white text-[#1E2320] border border-[#DAD5C9] shadow-md hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {obteniendoGps ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#1E2320] border-t-transparent rounded-full animate-spin" />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B2635" strokeWidth="2.5">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                <span>Mi Ubicación</span>
              </>
            )}
          </button>

          {/* Botón Centrar en Marcador */}
          <button
            type="button"
            onClick={reenfocarMarcador}
            title="Centrar mapa en el punto seleccionado"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/95 text-[#1E2320] border border-[#DAD5C9] shadow-sm hover:bg-white active:scale-95 transition-all cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Centrar Pin</span>
          </button>
        </div>
      </div>

      {/* Mensaje de GPS o Error */}
      {gpsMensaje && !error && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
          <span>{gpsMensaje}</span>
        </p>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-800 p-0.5 rounded cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
