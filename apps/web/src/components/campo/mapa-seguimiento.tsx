"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ColaboradorSeguimiento } from "@/types/seguimiento";
import { estadoUbicacion, textoEstadoUbicacion } from "@/utils/seguimiento";
import {
  CAPA_MAPA_CLARA,
  CAPA_MAPA_OSCURA,
  useTemaOscuroMapa,
} from "./ui/use-tema-mapa";

export function MapaSeguimiento({
  personas,
  seleccionada,
}: {
  personas: ColaboradorSeguimiento[];
  seleccionada: number | null;
}) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcadores = useRef(new Map<number, L.CircleMarker>());
  const animaciones = useRef(new Map<number, number>());
  const ajustado = useRef(false);
  const oscuro = useTemaOscuroMapa();
  useEffect(() => {
    if (!elemento.current) return;
    const m = L.map(elemento.current).setView([-25.3, -57.6], 11);
    mapa.current = m;
    const capa = L.tileLayer(CAPA_MAPA_CLARA, {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap · CARTO",
    }).addTo(m);
    m.getContainer().dataset.temaCapa = "claro";
    const observador = new ResizeObserver(() => m.invalidateSize());
    observador.observe(elemento.current);
    const pendientes = animaciones.current;
    const puntosActuales = marcadores.current;
    return () => {
      observador.disconnect();
      pendientes.forEach(cancelAnimationFrame);
      pendientes.clear();
      puntosActuales.clear();
      m.removeLayer(capa);
      m.remove();
      mapa.current = null;
      ajustado.current = false;
    };
  }, []);
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    m.eachLayer((capa) => {
      if (capa instanceof L.TileLayer)
        capa.setUrl(oscuro ? CAPA_MAPA_OSCURA : CAPA_MAPA_CLARA);
    });
  }, [oscuro]);
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const ids = new Set<number>();
    const puntos: L.LatLngExpression[] = [];
    for (const p of personas) {
      const t = p.telefono;
      if (
        t.latitud === null ||
        t.longitud === null ||
        !Number.isFinite(t.latitud) ||
        !Number.isFinite(t.longitud)
      )
        continue;
      ids.add(p.id);
      puntos.push([t.latitud, t.longitud]);
      const estado = estadoUbicacion(p);
      const color = estado === "ACTUALIZADO" ? "#15803d" : "#64748b";
      let marcador = marcadores.current.get(p.id);
      if (!marcador) {
        marcador = L.circleMarker([t.latitud, t.longitud], {
          radius: 9,
          color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 3,
        }).addTo(m);
        marcadores.current.set(p.id, marcador);
      } else {
        const anterior = marcador.getLatLng();
        const destino = L.latLng(t.latitud, t.longitud);
        const animacionPrevia = animaciones.current.get(p.id);
        if (animacionPrevia) cancelAnimationFrame(animacionPrevia);
        const inicio = performance.now();
        const punto = marcador;
        const mover = (ahora: number) => {
          const fraccion = Math.min(1, (ahora - inicio) / 1000);
          punto.setLatLng([
            anterior.lat + (destino.lat - anterior.lat) * fraccion,
            anterior.lng + (destino.lng - anterior.lng) * fraccion,
          ]);
          if (fraccion < 1)
            animaciones.current.set(p.id, requestAnimationFrame(mover));
        };
        animaciones.current.set(p.id, requestAnimationFrame(mover));
        marcador.setStyle({ color, fillColor: color });
      }
      const popup = document.createElement("div");
      const nombre = document.createElement("strong");
      nombre.textContent = p.nombre;
      popup.append(nombre);
      for (const texto of [
        p.rol,
        textoEstadoUbicacion(estado),
        `Último reporte: ${t.capturadaEn ? new Date(t.capturadaEn).toLocaleTimeString("es-PY") : "—"}`,
        `Precisión: ±${Math.round(t.precisionMetros ?? 0)} m`,
        p.visita ? `Local: ${p.visita.local.nombre}` : "Sin visita abierta",
        p.visita?.actividad
          ? `${p.visita.actividad.estado}: ${p.visita.actividad.nombre}`
          : "Sin tarea iniciada",
      ]) {
        const linea = document.createElement("p");
        linea.textContent = texto;
        popup.append(linea);
      }
      marcador.bindPopup(popup);
    }
    for (const [id, marcador] of marcadores.current)
      if (!ids.has(id)) {
        marcador.remove();
        marcadores.current.delete(id);
        const a = animaciones.current.get(id);
        if (a) cancelAnimationFrame(a);
        animaciones.current.delete(id);
      }
    if (!ajustado.current && puntos.length) {
      m.fitBounds(L.latLngBounds(puntos), { padding: [32, 32], maxZoom: 15 });
      ajustado.current = true;
    }
  }, [personas]);
  useEffect(() => {
    if (seleccionada === null) return;
    const marcador = marcadores.current.get(seleccionada);
    if (marcador && mapa.current) {
      mapa.current.flyTo(marcador.getLatLng(), 15, { duration: 0.5 });
      marcador.openPopup();
    }
  }, [seleccionada]);
  return (
    <div
      ref={elemento}
      role="region"
      aria-label="Mapa de las últimas ubicaciones reportadas de los colaboradores de esta página"
      className="campo-map h-[48dvh] min-h-80 w-full rounded-xl border border-line sm:h-[560px] [&_.leaflet-control-zoom_a]:h-11 [&_.leaflet-control-zoom_a]:w-11 [&_.leaflet-control-zoom_a]:leading-11"
    />
  );
}
