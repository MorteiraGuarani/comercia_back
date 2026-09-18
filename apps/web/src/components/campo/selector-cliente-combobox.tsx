"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { IconoBuscar, IconoCheck, IconoCruz, IconoChevronAbajo, IconoCliente } from "./ui/iconos-campo";
import type { ClienteCampo } from "@/types/campo";

interface Props {
  valorId: number | null | undefined;
  clienteSeleccionado?: { id: number; nombre: string; logoUrl?: string | null; ruc?: string } | null;
  alSeleccionar: (cliente: ClienteCampo) => void;
  alLimpiar?: () => void;
  clientesIniciales?: ClienteCampo[];
  placeholder?: string;
  requerido?: boolean;
  disabled?: boolean;
}

export function SelectorClienteCombobox({
  valorId,
  clienteSeleccionado,
  alSeleccionar,
  alLimpiar,
  clientesIniciales = [],
  placeholder = "Buscar cliente o cadena comercial...",
  requerido = false,
  disabled = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [clientes, setClientes] = useState<ClienteCampo[]>(clientesIniciales);
  const [cargando, setCargando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar clientes iniciales si cambian
  useEffect(() => {
    if (clientesIniciales.length === 0) return;
    const sincronizar = window.setTimeout(() => setClientes(clientesIniciales), 0);
    return () => window.clearTimeout(sincronizar);
  }, [clientesIniciales]);

  // Si no hay clientes cargados, cargamos catálogo amplio del backend (hasta 1000)
  useEffect(() => {
    if (clientes.length !== 0 || disabled) return;
    let montado = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const res = await apiFetch<{ items: ClienteCampo[] }>("/campo/clientes?limit=1000");
        if (montado && res?.items) setClientes(res.items);
      } catch {
        // El selector conserva las opciones disponibles si la carga falla.
      } finally {
        if (montado) setCargando(false);
      }
    };
    void cargar();
    return () => {
      montado = false;
    };
  }, [clientes.length, disabled]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function manejarClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClickFuera);
    return () => document.removeEventListener("mousedown", manejarClickFuera);
  }, []);

  // Determinar cliente activo
  const clienteActual = useMemo(() => {
    if (!valorId) return clienteSeleccionado || null;
    const encontrado = clientes.find((c) => c.id === valorId);
    if (encontrado) return encontrado;
    return clienteSeleccionado || null;
  }, [valorId, clientes, clienteSeleccionado]);

  // Filtrado de opciones en tiempo real
  const opcionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.ruc && c.ruc.toLowerCase().includes(q)) ||
        (c.contacto && c.contacto.toLowerCase().includes(q)),
    );
  }, [clientes, busqueda]);

  const iniciales = (nombre: string) => {
    return (
      nombre
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "CL"
    );
  };

  return (
    <div ref={contenedorRef} className="relative w-full text-left">
      {/* Caja de selección / Input de búsqueda */}
      {clienteActual && !abierto ? (
        <div
          onClick={() => {
            if (!disabled) {
              setAbierto(true);
              setBusqueda("");
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border bg-white cursor-pointer transition-all hover:border-zinc-400 ${
            disabled ? "opacity-60 cursor-not-allowed bg-zinc-50" : ""
          }`}
          style={{ borderColor: "#DAD5C9" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {clienteActual.logoUrl ? (
              <img
                src={clienteActual.logoUrl}
                alt={clienteActual.nombre}
                className="w-7 h-7 rounded-md object-cover border border-zinc-200 shrink-0 bg-zinc-50"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-[#1E2320] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {iniciales(clienteActual.nombre)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1E2320] truncate leading-tight">
                {clienteActual.nombre}
              </p>
              {clienteActual.ruc && (
                <p className="text-[11px] font-mono text-zinc-500 truncate">
                  RUC: {clienteActual.ruc}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {alLimpiar && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  alLimpiar();
                  setBusqueda("");
                  setAbierto(false);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition cursor-pointer"
                title="Cambiar cliente"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            )}
            <IconoChevronAbajo className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      ) : (
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none">
            <IconoBuscar className="w-4 h-4" />
          </span>

          <input
            ref={inputRef}
            type="text"
            required={requerido && !valorId}
            value={busqueda}
            disabled={disabled}
            onFocus={() => setAbierto(true)}
            onChange={(e) => {
              setBusqueda(e.target.value);
              if (!abierto) setAbierto(true);
            }}
            placeholder={placeholder}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border bg-white text-[#1E2320] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1E2320] transition"
            style={{ borderColor: "#DAD5C9" }}
          />

          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 gap-1">
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setAbierto((prev) => !prev)}
              className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer"
            >
              <IconoChevronAbajo className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Dropdown con resultados coincidentes */}
      {abierto && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-[2500] rounded-xl border bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ borderColor: "#DAD5C9" }}
        >
          {cargando ? (
            <div className="p-4 text-center text-xs text-zinc-500 font-mono">
              <span className="inline-block w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mr-2" />
              Cargando clientes...
            </div>
          ) : opcionesFiltradas.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs font-semibold text-zinc-700">
                No se encontraron clientes coincidentes
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Prueba con otro nombre comercial o RUC
              </p>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100">
              <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <span>Coincidencias ({opcionesFiltradas.length})</span>
                <span>Seleccionar</span>
              </div>
              {opcionesFiltradas.map((cliente) => {
                const esSeleccionado = cliente.id === valorId;
                return (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => {
                      alSeleccionar(cliente);
                      setAbierto(false);
                      setBusqueda("");
                    }}
                    className={`w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      esSeleccionado
                        ? "bg-zinc-100/90 text-[#1E2320]"
                        : "hover:bg-zinc-50 text-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {cliente.logoUrl ? (
                        <img
                          src={cliente.logoUrl}
                          alt={cliente.nombre}
                          className="w-8 h-8 rounded-md object-cover border border-zinc-200 shrink-0 bg-zinc-50"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-[#1E2320] text-white font-black text-xs flex items-center justify-center shrink-0">
                          {iniciales(cliente.nombre)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1E2320] leading-tight truncate">
                          {cliente.nombre}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                          {cliente.ruc && (
                            <span className="font-mono">RUC: {cliente.ruc}</span>
                          )}
                          {cliente.contacto && (
                            <span className="truncate">· {cliente.contacto}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {esSeleccionado ? (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1E2320] text-white">
                          <IconoCheck className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 font-medium hover:text-zinc-700">
                          Elegir
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
