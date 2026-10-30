"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PersonaEnVivo, Recorrido } from "@/types/ubicacion";
import { formatoDuracionMinutos } from "@/utils/duracion";
import { formatoFechaHora, formatoHora } from "@/utils/fechas";
import { inicialesNombre } from "@/utils/foto-local";
import { escaparHtml } from "@/utils/html";
import { MINUTOS_SIN_SENAL, minutosDesde, textoHace, textoVelocidad } from "@/utils/ubicacion";
import { CAPA_MAPA, CLASE_CAPA_OSCURA, useTemaOscuroMapa } from "./ui/use-tema-mapa";

const TRAZO = "#0E65D8";
const HUECO = "#7A7F7C";
/** Igual que la API: más separados que esto, el tramo es «sin señal». */
const HUECO_MS = 20 * 60_000;
const ASUNCION: L.LatLngTuple = [-25.29, -57.6];

const ficha = (texto: string, fondo: string, forma = "50%") =>
  `<div style="width:34px;height:34px;border-radius:${forma};background:${fondo};color:#fff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:700 12px sans-serif;">${escaparHtml(texto)}</div>`;
const icono = (html: string) =>
  L.divIcon({ className: "campo-marcador-usuario", html, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] });
const popup = (titulo: string, ...lineas: string[]) =>
  `<strong>${escaparHtml(titulo)}</strong>${lineas.map((l) => `<p style="margin:4px 0 0">${escaparHtml(l)}</p>`).join("")}`;

interface Props {
  /** Modo en vivo: última posición de cada persona. */
  personas?: PersonaEnVivo[];
  /** Modo recorrido: el trazo de un día. */
  recorrido?: Recorrido | null;
  /** Referencia de "ahora" para la antigüedad (hora del servidor). */
  ahora?: number;
  /** Al cambiar, el mapa vuelve a encuadrar todo; los refrescos no mueven la vista. */
  encuadre: string;
  foco: { latitud: number; longitud: number } | null;
  etiqueta: string;
}

export function MapaUbicaciones({ personas, recorrido, ahora, encuadre, foco, etiqueta }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaRef = useRef<L.LayerGroup | null>(null);
  const encuadradoRef = useRef<string | null>(null);
  const temaOscuro = useTemaOscuroMapa();

  useEffect(() => {
    if (!contenedorRef.current) return;
    // Canvas: el recorrido puede tener miles de puntos.
    const mapa = L.map(contenedorRef.current, { preferCanvas: true }).setView(ASUNCION, 12);
    L.tileLayer(CAPA_MAPA, {
      className: temaOscuro ? CLASE_CAPA_OSCURA : "",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(mapa);
    mapaRef.current = mapa;
    capaRef.current = L.layerGroup().addTo(mapa);
    encuadradoRef.current = null;
    const observador = new ResizeObserver(() => mapa.invalidateSize());
    observador.observe(contenedorRef.current);
    return () => {
      observador.disconnect();
      mapaRef.current = null;
      capaRef.current = null;
      mapa.remove();
    };
  }, [temaOscuro]);

  // temaOscuro también vuelve a dibujar sobre el mapa recién creado.
  useEffect(() => {
    const mapa = mapaRef.current;
    const capa = capaRef.current;
    if (!mapa || !capa) return;
    capa.clearLayers();
    const visibles: L.LatLngTuple[] = [];

    if (recorrido) {
      const hora = recorrido.dias > 1 ? formatoFechaHora : formatoHora;
      // Un hueco sin señal se marca punteado: no se sabe por dónde fue.
      const lineas: L.LatLngTuple[][] = [];
      recorrido.puntos.forEach((p, i) => {
        const previo = recorrido.puntos[i - 1];
        const punto: L.LatLngTuple = [p.latitud, p.longitud];
        visibles.push(punto);
        if (previo && Date.parse(p.capturadaEn) - Date.parse(previo.capturadaEn) <= HUECO_MS) {
          lineas[lineas.length - 1].push(punto);
          return;
        }
        if (previo)
          L.polyline([[previo.latitud, previo.longitud], punto], { color: HUECO, weight: 2, opacity: 0.8, dashArray: "6 8" }).addTo(capa);
        lineas.push([punto]);
      });
      for (const linea of lineas)
        if (linea.length > 1) L.polyline(linea, { color: TRAZO, weight: 4, opacity: 0.8 }).addTo(capa);
      for (const p of recorrido.puntos)
        L.circleMarker([p.latitud, p.longitud], { radius: 3, color: TRAZO, weight: 1, fillOpacity: 1 })
          .bindTooltip(`${hora(p.capturadaEn)} · ±${Math.round(p.precisionMetros)} m`)
          .addTo(capa);
      for (const t of recorrido.tramos)
        if (t.tipo === "parada" && t.latitud !== undefined && t.longitud !== undefined)
          L.circleMarker([t.latitud, t.longitud], { radius: 11, color: "#8b2635", weight: 3, fillColor: "#c98248", fillOpacity: 0.85 })
            .bindPopup(popup(`Detenido ${formatoDuracionMinutos(t.minutos)}`, `${hora(t.desde)} – ${formatoHora(t.hasta)}`))
            .addTo(capa);
      recorrido.visitas.forEach((v, i) => {
        if (v.latitud === null || v.longitud === null) return;
        visibles.push([v.latitud, v.longitud]);
        L.marker([v.latitud, v.longitud], { icon: icono(ficha(String(i + 1), "#1E2320", "9px")), title: v.local.nombre })
          .bindPopup(popup(v.local.nombre, `Entrada ${hora(v.entrada)} · Salida ${v.salida ? formatoHora(v.salida) : "sin marcar"}`))
          .addTo(capa);
      });
      const [inicio, fin] = [recorrido.puntos[0], recorrido.puntos[recorrido.puntos.length - 1]];
      if (inicio)
        L.circleMarker([inicio.latitud, inicio.longitud], { radius: 8, color: "#fff", weight: 3, fillColor: "#4F7A52", fillOpacity: 1 })
          .bindPopup(popup("Primer punto", hora(inicio.capturadaEn)))
          .addTo(capa);
      if (fin && fin !== inicio)
        L.circleMarker([fin.latitud, fin.longitud], { radius: 8, color: "#fff", weight: 3, fillColor: "#A32F2F", fillOpacity: 1 })
          .bindPopup(popup("Último punto", hora(fin.capturadaEn)))
          .addTo(capa);
    }

    for (const p of personas ?? []) {
      if (!p.ultima) continue;
      const { latitud, longitud, precisionMetros, velocidadMps, capturadaEn } = p.ultima;
      visibles.push([latitud, longitud]);
      const apagado = minutosDesde(capturadaEn, ahora) > MINUTOS_SIN_SENAL;
      const detalle = [textoHace(capturadaEn, ahora), `±${Math.round(precisionMetros)} m`, textoVelocidad(velocidadMps)];
      L.marker([latitud, longitud], {
        icon: icono(ficha(inicialesNombre(p.nombre), apagado ? "#7A7F7C" : TRAZO)),
        title: p.nombre,
        zIndexOffset: apagado ? 0 : 1000,
      })
        .bindPopup(popup(p.nombre, ...[p.rol, detalle.filter(Boolean).join(" · ")].filter((l): l is string => !!l)))
        .addTo(capa);
    }

    if (encuadradoRef.current !== encuadre && visibles.length) {
      encuadradoRef.current = encuadre;
      if (visibles.length === 1) mapa.setView(visibles[0], 16);
      else mapa.fitBounds(L.latLngBounds(visibles), { padding: [40, 40], maxZoom: 17 });
    }
  }, [personas, recorrido, ahora, encuadre, temaOscuro]);

  useEffect(() => {
    if (foco) mapaRef.current?.flyTo([foco.latitud, foco.longitud], 17, { duration: 0.8 });
  }, [foco]);

  return (
    <div className="campo-map overflow-hidden rounded-xl border border-line bg-surface-soft">
      <div ref={contenedorRef} role="region" aria-label={etiqueta} className="h-[min(55dvh,32rem)] min-h-72 w-full" />
    </div>
  );
}
