"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Modal } from "@/components/modal";
import { formatoDistancia, metrosEntre } from "@/utils/distancia";
import type { LocalCampo } from "@/types/campo";
import { montarCapaUsuario, type CapaUsuarioMapa } from "./ui/marcador-usuario-mapa";
import { useGeolocalizacionMapa } from "./ui/use-geolocalizacion-mapa";
import { CAPA_MAPA, CLASE_CAPA_OSCURA, useTemaOscuroMapa } from "./ui/use-tema-mapa";

export function MapaLocal({
  local,
  cerrar,
}: {
  local: LocalCampo;
  cerrar: () => void;
}) {
  const { latitud: lat, longitud: lng } = local;
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaUsuarioRef = useRef<CapaUsuarioMapa | null>(null);
  const gps = useGeolocalizacionMapa();
  const posicionGpsRef = useRef(gps.posicion);
  const temaOscuro = useTemaOscuroMapa();

  useEffect(() => {
    posicionGpsRef.current = gps.posicion;
  }, [gps.posicion]);

  useEffect(() => {
    if (!contenedorRef.current) return;

    const mapa = L.map(contenedorRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
      doubleClickZoom: true,
    }).setView([lat, lng], 16);
    mapaRef.current = mapa;

    L.tileLayer(CAPA_MAPA, {
      className: temaOscuro ? CLASE_CAPA_OSCURA : "",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · &copy; CARTO',
    }).addTo(mapa);

    L.circleMarker([lat, lng], {
      radius: 9,
      color: "#8b2635",
      weight: 3,
      fillColor: "#c98248",
      fillOpacity: 1,
    })
      .addTo(mapa)
      .bindPopup(`<strong>${local.nombre}</strong><br />${local.direccion || "Sin dirección fijada"}`)
      .openPopup();

    const yo = posicionGpsRef.current;
    if (yo) {
      capaUsuarioRef.current = montarCapaUsuario(mapa, L, yo.latitud, yo.longitud, yo.precision);
    }

    const observer = new ResizeObserver(() => mapa.invalidateSize());
    observer.observe(contenedorRef.current);

    return () => {
      observer.disconnect();
      capaUsuarioRef.current = null;
      mapaRef.current = null;
      mapa.remove();
    };
  }, [lat, lng, local.direccion, local.nombre, temaOscuro]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !gps.posicion) return;
    const { latitud, longitud, precision } = gps.posicion;
    if (!capaUsuarioRef.current) {
      capaUsuarioRef.current = montarCapaUsuario(mapa, L, latitud, longitud, precision);
    } else {
      capaUsuarioRef.current.actualizar(latitud, longitud, precision);
    }
  }, [gps.posicion]);

  // Distancia en línea recta y tiempo estimado en auto (25 km/h en ciudad).
  const metros = gps.posicion
    ? metrosEntre(gps.posicion, { latitud: lat, longitud: lng })
    : null;
  const minutos = metros !== null ? Math.max(1, Math.round((metros / 1000 / 25) * 60)) : null;

  return (
    <Modal titulo={local.nombre} abierto onCerrar={cerrar} ancho="xl" hojaMovil>
      <div className="campo-screen space-y-3">
        <div className="campo-map relative overflow-hidden rounded-xl border border-line bg-surface-soft">
          <div
            ref={contenedorRef}
            className="h-[min(48dvh,30rem)] min-h-64 w-full"
            aria-label={`Mapa de ubicación de ${local.nombre}`}
          />
          <button
            type="button"
            onClick={() => {
              if (gps.posicion && mapaRef.current) {
                mapaRef.current.flyTo([gps.posicion.latitud, gps.posicion.longitud], 16, {
                  animate: true,
                  duration: 0.9,
                });
                return;
              }
              gps.iniciar();
            }}
            disabled={gps.estado === "loading"}
            className="absolute right-3 top-3 z-[1000] flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 text-xs font-bold text-foreground shadow-md transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait"
          >
            {gps.estado === "loading" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            ) : (
              <span className="campo-usuario campo-usuario--boton" aria-hidden="true">
                <span className="campo-usuario__pulso" />
                <span className="campo-usuario__punto" />
              </span>
            )}
            <span>{gps.estado === "live" ? "Estás aquí" : "Mi ubicación"}</span>
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)]">
          <p className="truncate text-base font-bold text-foreground">{local.nombre}</p>
          <p className="mt-0.5 text-xs text-muted">{local.direccion || "Sin dirección cargada"}</p>
          <p className="mt-1.5 text-xs font-semibold text-foreground">
            {metros !== null && minutos !== null ? (
              <>
                {minutos} min · {formatoDistancia(metros)}{" "}
                <span className="font-normal text-muted">desde tu ubicación (aprox.)</span>
              </>
            ) : gps.estado === "error" ? (
              <span className="font-normal text-muted">No pudimos obtener tu ubicación para calcular la distancia.</span>
            ) : (
              <button
                type="button"
                onClick={gps.iniciar}
                disabled={gps.estado === "loading"}
                className="min-h-11 cursor-pointer rounded font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait dark:text-brand-200"
              >
                {gps.estado === "loading" ? "Buscando tu ubicación…" : "Ver a cuánto estás"}
              </button>
            )}
          </p>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M3 11l19-9-9 19-2-8-8-2z" />
            </svg>
            Cómo llegar en Google Maps
          </a>
        </div>
      </div>
    </Modal>
  );
}
