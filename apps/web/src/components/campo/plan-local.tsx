"use client";

import React, { useState } from "react";
import { Modal } from "@/components/modal";
import { usePanel } from "@/components/panel/contexto";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { IconoEquipo } from "./ui/iconos-campo";
import type { LocalCampo } from "@/types/campo";
import { HorariosLocal } from "./horarios-local";
import { AsignacionesLocal } from "./asignaciones-local";
import { esRolLiderCampo } from "@/utils/rol-campo";

export function PlanLocal({
  local,
  cerrar,
}: {
  local: LocalCampo;
  cerrar: () => void;
}) {
  const [vista, setVista] = useState<"horarios" | "equipo">("horarios");
  const { usuario } = usePanel();
  const equipo = usuario.rol?.equipoCampo?.nombre ?? "Sin equipo operativo";
  const soloLectura = esRolLiderCampo(usuario.rol?.descripcion);

  return (
    <Modal
      titulo={`Planificación · ${local.nombre}`}
      abierto
      onCerrar={cerrar}
      ancho="xl"
    >
      <div className="campo-screen min-w-0 w-full space-y-5">
        <p className="text-sm text-muted">
          Equipo: <strong className="text-foreground">{equipo}</strong>. Los
          horarios y colaboradores se configuran para este equipo.
        </p>
        {/* Banner de Contexto */}
        <div
          className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2"
          style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
        >
          <div className="min-w-0 flex-1 break-words">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Cuenta Comercial
            </span>
            <p className="text-sm font-bold text-foreground">
              {local.cliente?.nombre ?? "Sin cliente"} —{" "}
              {local.direccion || "Sin dirección fijada"}
            </p>
          </div>
          <StatusStamp tone="frio" size="sm">
            PLANIFICACIÓN
          </StatusStamp>
        </div>

        {/* Segmented Tab Selector */}
        <div
          className="flex min-w-0 flex-wrap gap-2 border-b pb-3"
          style={{ borderColor: TOKENS.line }}
        >
          <button
            type="button"
            onClick={() => setVista("horarios")}
            className={`min-h-11 min-w-0 flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all sm:flex-none sm:px-4 ${
              vista === "horarios"
                ? "bg-foreground text-background shadow-sm"
                : "bg-surface-raised text-muted hover:text-foreground border"
            }`}
            style={{
              borderColor: vista === "horarios" ? "transparent" : TOKENS.line,
            }}
          >
            <span className="sm:hidden">Horarios</span>
            <span className="hidden sm:inline">
              ⏰ Horarios &amp; Franjas de Visita
            </span>
          </button>
          <button
            type="button"
            onClick={() => setVista("equipo")}
            className={`min-h-11 min-w-0 flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1.5 sm:flex-none sm:px-4 ${
              vista === "equipo"
                ? "bg-foreground text-background shadow-sm"
                : "bg-surface-raised text-muted hover:text-foreground border"
            }`}
            style={{
              borderColor: vista === "equipo" ? "transparent" : TOKENS.line,
            }}
          >
            <IconoEquipo className="h-3.5 w-3.5" />
            <span>Equipo</span>
          </button>
        </div>

        {/* Contenido según pestaña */}
        {vista === "horarios" ? (
          <HorariosLocal localId={local.id} soloLectura={soloLectura} />
        ) : (
          <AsignacionesLocal localId={local.id} soloLectura={soloLectura} />
        )}
      </div>
    </Modal>
  );
}
