"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/utils/error";
import { escaparHtml } from "@/utils/html";
import { inicialesNombre } from "@/utils/foto-local";
import { TOKENS } from "./tokens";
import { BuscadorLugarMapa } from "./ui/buscador-lugar-mapa";
import { montarCapaUsuario, type CapaUsuarioMapa } from "./ui/marcador-usuario-mapa";
import { useGeolocalizacionMapa } from "./ui/use-geolocalizacion-mapa";
import { CAPA_MAPA, CLASE_CAPA_OSCURA, useTemaOscuroMapa } from "./ui/use-tema-mapa";
import { IconoBuscar, IconoCruz } from "./ui/iconos-campo";
import type { LocalCampo } from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";
import { mostrarToast } from "@/components/toast/toast-controller";

const MAX_PAGINAS_MAPA = 4;

/** Mapa de cobertura: socios de OCRD con U_Latitud/U_Longitud cargadas. */
export function MapaClientes() {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [locales, setLocales] = useState<LocalCampo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busquedaTexto, setBusquedaTexto] = useState("");
  const gps = useGeolocalizacionMapa();
  const capaUsuarioRef = useRef<CapaUsuarioMapa | null>(null);
  const posicionGpsRef = useRef(gps.posicion);
  const temaOscuro = useTemaOscuroMapa();

  useEffect(() => {
    posicionGpsRef.current = gps.posicion;
  }, [gps.posicion]);

  // Puntos livianos filtrados en la API por búsqueda. Se piden como máximo
  // MAX_PAGINAS_MAPA páginas de 50: con más locales se avisa para acotar.
  const [totalLocales, setTotalLocales] = useState(0);
  const textoServidor = busquedaTexto.trim();
  useEffect(() => {
    let montado = true;
    const temporizador = window.setTimeout(async () => {
      try {
        setCargando(true);
        setError(null);
        const filtros = new URLSearchParams({ limit: "50" });
        if (textoServidor) filtros.set("buscar", textoServidor);
        const pagina = (n: number) =>
          apiFetch<RespuestaPaginada<LocalCampo>>(`/campo/locales/mapa?${filtros}&page=${n}`);
        const primera = await pagina(1);
        const ultima = Math.min(primera.totalPages, MAX_PAGINAS_MAPA);
        const resto = await Promise.all(
          Array.from({ length: Math.max(0, ultima - 1) }, (_, i) => pagina(i + 2)),
        );
        if (!montado) return;
        setLocales([...primera.items, ...resto.flatMap((r) => r.items)]);
        setTotalLocales(primera.total);
      } catch (e) {
        if (montado) setError(mensajeError(e, "Error al cargar locales en el mapa"));
      } finally {
        if (montado) setCargando(false);
      }
    }, textoServidor ? 400 : 0);
    return () => {
      montado = false;
      window.clearTimeout(temporizador);
    };
  }, [textoServidor]);

  // Inicializar Leaflet Map
  useEffect(() => {
    if (!contenedorRef.current) return;

    const map = L.map(contenedorRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
      doubleClickZoom: true,
    }).setView([-25.2969, -57.6415], 13);

    mapaRef.current = map;

    L.tileLayer(CAPA_MAPA, {
      className: temaOscuro ? CLASE_CAPA_OSCURA : "",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    const yo = posicionGpsRef.current;
    if (yo) {
      capaUsuarioRef.current = montarCapaUsuario(map, L, yo.latitud, yo.longitud, yo.precision);
    }

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(contenedorRef.current);

    return () => {
      observer.disconnect();
      capaUsuarioRef.current = null;
      map.remove();
      mapaRef.current = null;
      markersLayerRef.current = null;
    };
  }, [temaOscuro]);

  // Actualizar marcadores en el mapa y ajustar vista
  useEffect(() => {
    if (!mapaRef.current || !markersLayerRef.current) return;

    // Asegurar que el mapa mida correctamente el contenedor
    mapaRef.current.invalidateSize();
    markersLayerRef.current.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    locales.forEach((loc) => {
      const lat = Number(loc.latitud);
      const lng = Number(loc.longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos: L.LatLngTuple = [lat, lng];
      bounds.push(pos);

      const inicialesSeguras = escaparHtml(inicialesNombre(loc.nombre));
      const asignados = loc.asignaciones?.map(({ usuario }) =>
        `<div style="overflow-wrap:anywhere;">${escaparHtml(`${usuario.rol?.descripcion ?? "Impulsador"} ${usuario.nombre} ${usuario.apellido}`)}</div>`,
      ).join("");

      const innerAvatar = `<div style="position:relative;width:100%;height:100%;border-radius:50%;background:#8B2635;color:white;font-weight:bold;font-size:13px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">${inicialesSeguras}</div>`;

      const pinHtml = `
        <div style="position:relative;width:46px;height:56px;display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.38));">
          <div style="width:42px;height:42px;border-radius:50%;overflow:hidden;border:3px solid #1E2320;background:white;display:flex;align-items:center;justify-content:center;">
            ${innerAvatar}
          </div>
          <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid #1E2320;margin-top:-2px;"></div>
        </div>
      `;

      const icon = L.divIcon({
        className: "custom-cliente-marker-clean",
        html: pinHtml,
        iconSize: [46, 56],
        iconAnchor: [23, 56],
        popupAnchor: [0, -52],
      });

      const popupContent = `
        <div style="width:min(300px,calc(100vw - 80px));font-family:sans-serif;padding:8px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;border-bottom:1px solid #ECE9E2;padding-bottom:10px;">
            <span style="position:relative;flex:none;width:38px;height:38px;border-radius:50%;background:#1E2320;color:white;font-size:13px;font-weight:bold;display:flex;align-items:center;justify-content:center;">${inicialesSeguras}</span>
            <div>
              <h4 style="font-size:16px;font-weight:700;color:#1E2320;margin:0;line-height:1.2;overflow-wrap:anywhere;">${escaparHtml(loc.nombre)}</h4>
              <span style="font-size:11px;color:#888;font-family:monospace;">CardCode ${escaparHtml(loc.id)}</span>
            </div>
          </div>

          <p style="font-size:12px;color:#444;margin:0 0 8px 0;line-height:1.4;overflow-wrap:anywhere;">${escaparHtml(loc.direccion || "Sin dirección cargada")}</p>

          <div style="font-size:12px;color:#1E2320;margin:0 0 8px 0;padding:8px;border-radius:8px;background:#F8F7F4;">
            <span style="font-size:11px;font-weight:700;color:#726C60;display:block;margin-bottom:3px;">Personal asignado</span>
            ${asignados || '<span style="color:#666;">Sin asignar</span>'}
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px dashed #DAD5C9;">
            <span style="font-size:11px;font-family:monospace;color:#666;">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}"
              target="_blank"
              rel="noreferrer"
              style="font-size:12px;font-weight:bold;color:#8B2635;text-decoration:none;background:#F8F7F4;padding:4px 10px;border-radius:8px;border:1px solid #DAD5C9;"
            >
              Cómo llegar
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(pos, { icon }).bindPopup(popupContent);
      markersLayerRef.current?.addLayer(marker);
    });

    // Ajustar zoom y vista según los marcadores encontrados
    if (bounds.length === 1 && mapaRef.current) {
      mapaRef.current.setView(bounds[0], 16, { animate: true });
    } else if (bounds.length > 1 && mapaRef.current) {
      mapaRef.current.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 16 });
    }
  }, [locales]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !gps.posicion) return;
    const { latitud, longitud, precision } = gps.posicion;
    if (!capaUsuarioRef.current) {
      capaUsuarioRef.current = montarCapaUsuario(mapa, L, latitud, longitud, precision);
      mapa.flyTo([latitud, longitud], 15, { animate: true, duration: 1.1 });
    } else {
      capaUsuarioRef.current.actualizar(latitud, longitud, precision);
    }
  }, [gps.posicion]);

  const centrarEnMiUbicacion = () => {
    if (gps.posicion && mapaRef.current) {
      mapaRef.current.flyTo([gps.posicion.latitud, gps.posicion.longitud], 16, {
        animate: true,
        duration: 0.9,
      });
      return;
    }
    gps.iniciar();
    if (gps.estado === "error") {
      mostrarToast("alerta", "Revisá que el navegador tenga permiso de ubicación.", "No se pudo obtener tu ubicación");
    }
  };

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="break-words rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {/* Inyectar estilo para anular el fondo blanco y bordes de Leaflet divIcon */}
      <style>{`
        .custom-cliente-marker-clean,
        .leaflet-marker-icon.custom-cliente-marker-clean,
        .leaflet-marker-icon.campo-marcador-usuario {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* Barra de Filtros del Mapa con Input Autocompletable */}
      <div
        className="p-3.5 rounded-xl border flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-xs bg-surface-raised"
        style={{ borderColor: TOKENS.line }}
      >
        {/* Buscador de Local o Dirección */}
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1">
            Buscar punto de venta (nombre o CardCode):
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted pointer-events-none">
              <IconoBuscar className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              placeholder="Buscar por nombre o CardCode..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg border bg-surface-raised focus:outline-none focus:ring-2 focus:ring-focus"
              style={{ borderColor: TOKENS.line }}
            />
            {busquedaTexto && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => setBusquedaTexto("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted hover:text-foreground cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Contador de Marcadores y Status */}
        <div className="flex items-center gap-2 self-start lg:self-end pb-0.5 shrink-0">
          <span className="font-mono text-xs font-bold px-3 py-2 rounded-lg bg-surface-soft border border-line text-foreground shadow-xs">
            {locales.length} Puntos visibles
          </span>
          {totalLocales > locales.length && (
            <span role="status" className="text-xs font-medium text-amber-800 dark:text-amber-200">
              Mostrando {locales.length} de {totalLocales}. Buscá para ver el resto.
            </span>
          )}
        </div>
      </div>

      <BuscadorLugarMapa
        cerca={() => {
          const centro = mapaRef.current?.getCenter();
          return centro ? { latitud: centro.lat, longitud: centro.lng } : undefined;
        }}
        onElegir={(lugar) =>
          mapaRef.current?.flyTo([lugar.latitud, lugar.longitud], 17, {
            animate: true,
            duration: 0.8,
          })
        }
      />

      {/* Contenedor del Mapa Interactivo Amplio */}
      <div className="campo-map relative rounded-2xl border border-line overflow-hidden shadow-md bg-surface-soft">
        <div
          ref={contenedorRef}
          className="h-[720px] w-full z-0"
          aria-label="Mapa de cobertura de locales"
        />

        {/* Botón Mi Ubicación Flotante */}
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            type="button"
            onClick={centrarEnMiUbicacion}
            disabled={gps.estado === "loading"}
            title="Centrar en mi ubicación GPS"
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-surface-raised text-foreground border border-line shadow-xl hover:bg-surface-soft active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {gps.estado === "loading" ? (
              <span className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="campo-usuario campo-usuario--boton" aria-hidden="true">
                <span className="campo-usuario__pulso" />
                <span className="campo-usuario__punto" />
              </span>
            )}
            <span>{gps.estado === "live" ? "Estás aquí" : "Mi Ubicación"}</span>
          </button>
        </div>

        {cargando && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-[1001]">
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-surface-raised shadow-2xl border border-line text-base font-bold">
              <span className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
              <span>Cargando locales en el mapa de cobertura...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
