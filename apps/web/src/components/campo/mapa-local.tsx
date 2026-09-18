"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Modal } from "@/components/modal";
import { btnGhost } from "@/components/ui";
import type { LocalCampo } from "@/types/campo";
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
  const temaOscuro = useTemaOscuroMapa();

  useEffect(() => {
    if (!contenedorRef.current) return;

    const mapa = L.map(contenedorRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
      doubleClickZoom: true,
    }).setView([lat, lng], 16);

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

    const observer = new ResizeObserver(() => mapa.invalidateSize());
    observer.observe(contenedorRef.current);

    return () => {
      observer.disconnect();
      mapa.remove();
    };
  }, [lat, lng, local.direccion, local.nombre, temaOscuro]);

  return (
    <Modal titulo={local.nombre} abierto onCerrar={cerrar} ancho="lg">
      <div className="campo-screen space-y-3">
        <p className="text-sm text-muted">
          {local.direccion} · {lat}, {lng}
        </p>
        <div className="campo-map overflow-hidden rounded-xl border border-line bg-surface-soft">
          <div
            ref={contenedorRef}
            className="h-80 w-full"
            aria-label={`Mapa de ubicación de ${local.nombre}`}
          />
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
