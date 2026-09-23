"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/utils/error";
import { TOKENS } from "./tokens";
import { montarCapaUsuario, type CapaUsuarioMapa } from "./ui/marcador-usuario-mapa";
import { useGeolocalizacionMapa } from "./ui/use-geolocalizacion-mapa";
import { CAPA_MAPA_CLARA, CAPA_MAPA_OSCURA, useTemaOscuroMapa } from "./ui/use-tema-mapa";
import { IconoBuscar, IconoCruz, IconoCheck, IconoAlerta, IconoChevronAbajo, IconoPin } from "./ui/iconos-campo";
import type { ClienteCampo, LocalCampo } from "@/types/campo";

interface MapaClientesProps {
  clientes: ClienteCampo[];
  clienteSeleccionadoId?: number | null;
}

export function MapaClientes({ clientes, clienteSeleccionadoId }: MapaClientesProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [locales, setLocales] = useState<LocalCampo[]>([]);
  const clientesDisponibles = useMemo(() => {
    const porId = new Map(clientes.map((cliente) => [cliente.id, cliente]));
    for (const local of locales) {
      if (!porId.has(local.clienteId) && local.cliente) {
        porId.set(local.clienteId, {
          id: local.clienteId,
          nombre: local.cliente.nombre,
          logoUrl: local.cliente.logoUrl,
          ruc: "",
          contacto: "",
          telefono: "",
          activo: true,
        });
      }
    }
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [clientes, locales]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cliente seleccionado (objeto o null para todos)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteCampo | null>(() => {
    if (clienteSeleccionadoId) {
      return clientes.find((c) => c.id === clienteSeleccionadoId) ?? null;
    }
    return null;
  });

  // Estado del combobox de búsqueda de clientes
  const [busquedaClienteInput, setBusquedaClienteInput] = useState(() => {
    if (clienteSeleccionadoId) {
      const c = clientes.find((cli) => cli.id === clienteSeleccionadoId);
      return c ? c.nombre : "";
    }
    return "";
  });
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [busquedaTexto, setBusquedaTexto] = useState("");
  const gps = useGeolocalizacionMapa();
  const capaUsuarioRef = useRef<CapaUsuarioMapa | null>(null);
  const posicionGpsRef = useRef(gps.posicion);
  const temaOscuro = useTemaOscuroMapa();

  useEffect(() => {
    posicionGpsRef.current = gps.posicion;
  }, [gps.posicion]);

  // Sincronizar cuando cambia la prop clienteSeleccionadoId
  useEffect(() => {
    const sincronizar = window.setTimeout(() => {
      if (clienteSeleccionadoId) {
        const match = clientesDisponibles.find((c) => c.id === clienteSeleccionadoId);
        if (match) {
          setClienteSeleccionado(match);
          setBusquedaClienteInput(match.nombre);
        }
      } else if (clienteSeleccionadoId === null) {
        setClienteSeleccionado(null);
        setBusquedaClienteInput("");
      }
    }, 0);
    return () => window.clearTimeout(sincronizar);
  }, [clienteSeleccionadoId, clientesDisponibles]);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // La API admite 50 por página; cargar todas para que la cobertura sea completa.
  useEffect(() => {
    let montado = true;
    const cargar = async () => {
      try {
        setCargando(true);
        setError(null);
        const primera = await apiFetch<{ items: LocalCampo[]; totalPages: number }>("/campo/locales?page=1&limit=50");
        const todos = [...primera.items];
        for (let inicio = 2; inicio <= primera.totalPages; inicio += 4) {
          const paginas = await Promise.all(
            Array.from({ length: Math.min(4, primera.totalPages - inicio + 1) }, (_, indice) =>
              apiFetch<{ items: LocalCampo[] }>(`/campo/locales?page=${inicio + indice}&limit=50`),
            ),
          );
          todos.push(...paginas.flatMap((pagina) => pagina.items));
        }
        if (montado) setLocales(todos);
      } catch (e) {
        console.error("Error al cargar locales:", e);
        if (montado) setError(mensajeError(e, "Error al cargar locales en el mapa"));
      } finally {
        if (montado) setCargando(false);
      }
    };
    cargar();
    return () => {
      montado = false;
    };
  }, []);

  // Conteo de locales por cliente
  const conteoLocalesPorCliente = useMemo(() => {
    const mapa = new Map<number, number>();
    locales.forEach((loc) => {
      const cId = Number(loc.clienteId);
      mapa.set(cId, (mapa.get(cId) || 0) + 1);
    });
    return mapa;
  }, [locales]);

  // Clientes filtrados para el dropdown autocompletable
  const clientesFiltradosDropdown = useMemo(() => {
    const q = busquedaClienteInput.toLowerCase().trim();
    if (!q) return clientesDisponibles;
    return clientesDisponibles.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.ruc && c.ruc.toLowerCase().includes(q)) ||
        (c.contacto && c.contacto.toLowerCase().includes(q)),
    );
  }, [clientesDisponibles, busquedaClienteInput]);

  // Inicializar Leaflet Map
  useEffect(() => {
    if (!contenedorRef.current) return;

    const map = L.map(contenedorRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
      doubleClickZoom: true,
    }).setView([-25.2969, -57.6415], 13);

    mapaRef.current = map;

    L.tileLayer(temaOscuro ? CAPA_MAPA_OSCURA : CAPA_MAPA_CLARA, {
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

  // Filtrar locales según cliente seleccionado y búsqueda de texto
  const localesFiltrados = useMemo(() => {
    return locales.filter((loc) => {
      // 1. Filtrado por cliente
      if (clienteSeleccionado) {
        if (Number(loc.clienteId) !== Number(clienteSeleccionado.id)) {
          return false;
        }
      } else if (busquedaClienteInput.trim()) {
        // Si el usuario escribió un texto pero no seleccionó un cliente puntual del dropdown
        const q = busquedaClienteInput.toLowerCase().trim();
        const coincideCliente = loc.cliente?.nombre?.toLowerCase().includes(q);
        if (!coincideCliente) return false;
      }

      // 2. Filtrado por texto de local o dirección
      if (busquedaTexto.trim()) {
        const b = busquedaTexto.toLowerCase().trim();
        const coincideNombre = loc.nombre.toLowerCase().includes(b);
        const coincideDireccion = loc.direccion?.toLowerCase().includes(b);
        if (!coincideNombre && !coincideDireccion) return false;
      }

      return true;
    });
  }, [locales, clienteSeleccionado, busquedaClienteInput, busquedaTexto]);

  // Actualizar marcadores en el mapa y ajustar vista
  useEffect(() => {
    if (!mapaRef.current || !markersLayerRef.current) return;

    // Asegurar que el mapa mida correctamente el contenedor
    mapaRef.current.invalidateSize();
    markersLayerRef.current.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    localesFiltrados.forEach((loc) => {
      const lat = Number(loc.latitud);
      const lng = Number(loc.longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos: L.LatLngTuple = [lat, lng];
      bounds.push(pos);

      // Logo del cliente o iniciales
      const logoUrl = loc.cliente?.logoUrl;
      const nombreCliente = loc.cliente?.nombre || "Cliente";
      const iniciales = (nombreCliente || loc.nombre)
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const innerAvatar = logoUrl
        ? `<img src="${logoUrl}" alt="${nombreCliente}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
        : `<div style="width:100%;height:100%;border-radius:50%;background:#8B2635;color:white;font-weight:bold;font-size:13px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">${iniciales}</div>`;

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
        <div style="min-width:280px;max-width:340px;font-family:sans-serif;padding:8px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;border-bottom:1px solid #ECE9E2;padding-bottom:10px;">
            ${
              logoUrl
                ? `<img src="${logoUrl}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #DAD5C9;" />`
                : `<span style="font-size:13px;font-weight:bold;background:#1E2320;color:white;padding:4px 10px;border-radius:8px;">${iniciales}</span>`
            }
            <div>
              <span style="font-size:13px;font-weight:bold;text-transform:uppercase;color:#726C60;letter-spacing:0.5px;display:block;">${nombreCliente}</span>
              <span style="font-size:11px;color:#888;font-family:monospace;">Local #${loc.id}</span>
            </div>
          </div>

          <h4 style="font-size:16px;font-weight:700;color:#1E2320;margin:0 0 4px 0;line-height:1.2;">${loc.nombre}</h4>
          <p style="font-size:12px;color:#444;margin:0 0 8px 0;line-height:1.4;">${loc.direccion || "Sin dirección fijada"}</p>

          ${
            loc.telefono
              ? `<p style="font-size:12px;color:#2C4A6E;margin:0 0 8px 0;">Tel: <a href="tel:${loc.telefono}" style="color:#2C4A6E;font-weight:bold;text-decoration:none;">${loc.telefono}</a></p>`
              : ""
          }

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
  }, [localesFiltrados]);

  // Seleccionar un cliente desde el dropdown
  const elegirCliente = (c: ClienteCampo | null) => {
    setClienteSeleccionado(c);
    setBusquedaClienteInput(c ? c.nombre : "");
    setDropdownAbierto(false);
  };

  // Limpiar filtro de cliente
  const limpiarFiltroCliente = () => {
    setClienteSeleccionado(null);
    setBusquedaClienteInput("");
    setDropdownAbierto(false);
  };

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
      alert("No se pudo obtener tu ubicación actual.");
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
        className="p-3.5 rounded-xl border flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-xs bg-white"
        style={{ borderColor: TOKENS.line }}
      >
        {/* Selector Autocompletable de Cliente con Dropdown Flotante */}
        <div className="relative flex-1" ref={dropdownRef}>
          <label className="block text-[11px] font-bold text-[#1E2320] uppercase tracking-wider mb-1">
            Filtrar por Cliente Comercial:
          </label>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none">
              <IconoBuscar className="w-4 h-4" />
            </span>

            <input
              type="text"
              value={busquedaClienteInput}
              onChange={(e) => {
                setBusquedaClienteInput(e.target.value);
                setDropdownAbierto(true);
                if (!e.target.value.trim()) {
                  setClienteSeleccionado(null);
                }
              }}
              onFocus={() => setDropdownAbierto(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (clientesFiltradosDropdown.length > 0) {
                    elegirCliente(clientesFiltradosDropdown[0]);
                  }
                } else if (e.key === "Escape") {
                  setDropdownAbierto(false);
                }
              }}
              placeholder="Escribe el nombre de un cliente (ej. Frigorífico, Superseis...)"
              className="w-full pl-9 pr-14 py-2 text-xs sm:text-sm font-medium rounded-lg border bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
              style={{ borderColor: TOKENS.line }}
            />

            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
              {busquedaClienteInput && (
                <button
                  type="button"
                  onClick={limpiarFiltroCliente}
                  className="p-0.5 rounded text-zinc-400 hover:text-zinc-800 cursor-pointer"
                  title="Mostrar todos los clientes"
                >
                  <IconoCruz className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setDropdownAbierto((prev) => !prev)}
                className="p-0.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                title="Desplegar lista de clientes"
              >
                <IconoChevronAbajo className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Menú Flotante Dropdown de Coincidencias */}
          {dropdownAbierto && (
            <div
              className="absolute left-0 right-0 mt-1.5 max-h-72 overflow-y-auto rounded-xl border shadow-xl z-[2000] bg-white p-1.5 divide-y divide-zinc-100"
              style={{ borderColor: TOKENS.line }}
            >
              {/* Opción Todos los Clientes */}
              <button
                type="button"
                onClick={() => elegirCliente(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  clienteSeleccionado === null
                    ? "bg-[#1E2320] text-white"
                    : "hover:bg-zinc-100 text-zinc-800"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-md bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold text-[10px]">
                    ALL
                  </span>
                  <div>
                    <span className="block font-bold text-xs">Todos los Clientes</span>
                    <span className={`text-[11px] ${clienteSeleccionado === null ? "text-zinc-300" : "text-zinc-500"}`}>
                      {locales.length} puntos de venta totales en la red
                    </span>
                  </div>
                </div>
                {clienteSeleccionado === null && <IconoCheck className="w-4 h-4" />}
              </button>

              {/* Lista de clientes coincidentes */}
              {clientesFiltradosDropdown.length === 0 ? (
                <div className="p-5 text-center text-sm sm:text-base text-zinc-500">
                  No se encontraron clientes con &quot;{busquedaClienteInput}&quot;
                </div>
              ) : (
                clientesFiltradosDropdown.map((c) => {
                  const numLocales = conteoLocalesPorCliente.get(c.id) || 0;
                  const esActivo = clienteSeleccionado?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => elegirCliente(c)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                        esActivo
                          ? "bg-[#1E2320] text-white"
                          : "hover:bg-zinc-100 text-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {c.logoUrl ? (
                          <img
                            src={c.logoUrl}
                            alt={c.nombre}
                            className="w-7 h-7 rounded-md object-cover border border-white shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-md bg-[#8B2635] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {c.nombre.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate leading-snug">{c.nombre}</p>
                          <p className={`text-[11px] font-mono truncate ${esActivo ? "text-zinc-300" : "text-zinc-500"}`}>
                            {c.ruc ? `RUC: ${c.ruc} · ` : ""}
                            <span
                              className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                                numLocales > 0
                                  ? esActivo
                                    ? "bg-emerald-800 text-emerald-100"
                                    : "bg-emerald-100 text-emerald-800"
                                  : esActivo
                                    ? "bg-zinc-700 text-zinc-300"
                                    : "bg-zinc-200 text-zinc-600"
                              }`}
                            >
                              {numLocales} {numLocales === 1 ? "local" : "locales"}
                            </span>
                          </p>
                        </div>
                      </div>
                      {esActivo && <IconoCheck className="w-4 h-4 shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Buscador de Local o Dirección */}
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-[#1E2320] uppercase tracking-wider mb-1">
            Buscar Punto de Venta o Dirección:
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none">
              <IconoBuscar className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              placeholder="Buscar por local, calle, ciudad..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
              style={{ borderColor: TOKENS.line }}
            />
            {busquedaTexto && (
              <button
                type="button"
                onClick={() => setBusquedaTexto("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-800 cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Contador de Marcadores y Status */}
        <div className="flex items-center gap-2 self-start lg:self-end pb-0.5 shrink-0">
          <span className="font-mono text-xs font-bold px-3 py-2 rounded-lg bg-zinc-100 border border-[#DAD5C9] text-zinc-800 shadow-xs">
            {localesFiltrados.length} Puntos visibles
          </span>
        </div>
      </div>

      {/* Aviso si el cliente seleccionado NO tiene locales */}
      {clienteSeleccionado && localesFiltrados.length === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <IconoAlerta className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-bold text-xs sm:text-sm">
                El cliente &quot;{clienteSeleccionado.nombre}&quot; no tiene locales registrados en el mapa todavía.
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Puedes registrar nuevos puntos de venta para este cliente desde la sección de <b>Locales & Rutas</b>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={limpiarFiltroCliente}
            className="px-3.5 py-1.5 rounded-lg bg-amber-200/90 hover:bg-amber-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0"
          >
            Ver todos los locales
          </button>
        </div>
      )}

      {/* Contenedor del Mapa Interactivo Amplio */}
      <div className="relative rounded-2xl border border-[#DAD5C9] overflow-hidden shadow-md bg-zinc-100">
        <div
          ref={contenedorRef}
          className="h-[720px] w-full z-0"
          aria-label="Mapa de cobertura de clientes y locales"
        />

        {/* Botón Mi Ubicación Flotante */}
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            type="button"
            onClick={centrarEnMiUbicacion}
            disabled={gps.estado === "loading"}
            title="Centrar en mi ubicación GPS"
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-white text-[#1E2320] border border-[#DAD5C9] shadow-xl hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {gps.estado === "loading" ? (
              <span className="w-4 h-4 border-2 border-[#1E2320] border-t-transparent rounded-full animate-spin" />
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
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white shadow-2xl border border-zinc-200 text-base font-bold">
              <span className="w-6 h-6 border-2 border-[#1E2320] border-t-transparent rounded-full animate-spin" />
              <span>Cargando locales en el mapa de cobertura...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
