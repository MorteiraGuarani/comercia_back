"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Modal } from "@/components/modal";
import { btnGhost } from "@/components/ui";
import type { LocalCampo } from "@/types/campo";
import { montarCapaUsuario, type CapaUsuarioMapa } from "./ui/marcador-usuario-mapa";
import { useGeolocalizacionMapa } from "./ui/use-geolocalizacion-mapa";
import { CAPA_MAPA_CLARA, CAPA_MAPA_OSCURA, useTemaOscuroMapa } from "./ui/use-tema-mapa";

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

    L.tileLayer(temaOscuro ? CAPA_MAPA_OSCURA : CAPA_MAPA_CLARA, {
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

  return (
    <Modal titulo={local.nombre} abierto onCerrar={cerrar} ancho="xl">
      <div className="campo-screen space-y-3">
        <p className="text-sm text-muted">
          {local.direccion} · {lat}, {lng}
        </p>
        <div className="campo-map relative overflow-hidden rounded-xl border border-line bg-surface-soft">
          <div
            ref={contenedorRef}
            className="h-[min(56dvh,30rem)] min-h-80 w-full"
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
            className="absolute top-3 right-3 z-[1000] flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-white text-[#1E2320] border border-[#DAD5C9] shadow-md"
          >
            {gps.estado === "loading" ? (
              <span className="w-3.5 h-3.5 border-2 border-[#1E2320] border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="campo-usuario campo-usuario--boton" aria-hidden="true">
                <span className="campo-usuario__pulso" />
                <span className="campo-usuario__punto" />
              </span>
            )}
            <span>{gps.estado === "live" ? "Estás aquí" : "Mi ubicación"}</span>
          </button>
        </div>
      </div>
      <a
        className={`${btnGhost} mt-3 w-full`}
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir ubicación en Maps
      </a>
    </Modal>
  );
}
