import React from "react";
import { TOKENS } from "../tokens";
import { StatusStamp } from "./status-stamp";
import { BigProgress } from "./big-progress";
import type { ColaboradorResumen } from "@/types/campo";

interface CollaboratorRowProps {
  colaborador: ColaboradorResumen;
  metric: "presentismo" | "ruta" | "tareas";
  onOpen: () => void;
  className?: string;
}

export function CollaboratorRow({
  colaborador: v,
  metric,
  onOpen,
  className = "",
}: CollaboratorRowProps) {
  const asistenciaMeta = {
    en_curso: { tone: "frio" as const, label: "EN RUTA" },
    finalizado: { tone: "fresco" as const, label: "FINALIZADO" },
    sin_iniciar: { tone: "critico" as const, label: "SIN INICIAR" },
  };

  const am = asistenciaMeta[v.asistencia] ?? asistenciaMeta.sin_iniciar;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-all hover:brightness-[0.98] active:scale-[0.99] cursor-pointer select-none ${className}`}
      style={{
        background: TOKENS.canvas,
        border: `1px solid ${TOKENS.line}`,
      }}
    >
      {/* Avatar circular con iniciales */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ft-display text-sm font-bold tracking-wider"
        style={{
          background: TOKENS.ink,
          color: "#ffffff",
        }}
      >
        {v.iniciales}
      </div>

      {/* Cuerpo central */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className="ft-body font-semibold text-sm truncate leading-snug"
            style={{ color: TOKENS.ink }}
          >
            {v.nombre}
          </p>
          <StatusStamp tone={am.tone}>{am.label}</StatusStamp>
        </div>

        <p className="ft-body text-xs mb-1 truncate" style={{ color: TOKENS.sub }}>
          {v.zona}
        </p>

        {/* Métrica de Presentismo */}
        {metric === "presentismo" && (
          <p
            className="ft-mono text-xs flex items-center gap-1.5 font-semibold"
            style={{ color: TOKENS.ink }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-zinc-500"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>
              {v.inicioJornada ?? "—"} →{" "}
              {v.finJornada ?? (v.asistencia === "en_curso" ? "en curso" : "—")}
            </span>
          </p>
        )}

        {/* Métrica de Ruta */}
        {metric === "ruta" && (
          <div>
            <div
              className="flex justify-between ft-body text-xs mb-1 font-medium"
              style={{ color: TOKENS.sub }}
            >
              <span>
                {v.ruta.completadas}/{v.ruta.total} visitas
              </span>
              <span className="font-bold text-zinc-900">{v.ruta.pct}%</span>
            </div>
            <BigProgress pct={v.ruta.pct} color={TOKENS.frio} />
          </div>
        )}

        {/* Métrica de Tareas */}
        {metric === "tareas" && (
          <div>
            <div
              className="flex justify-between ft-body text-xs mb-1 font-medium"
              style={{ color: TOKENS.sub }}
            >
              <span className="flex items-center gap-1">
                {v.tareas.completadas}/{v.tareas.total} tareas
                {v.tareas.obligPendientes > 0 && (
                  <span
                    title={`${v.tareas.obligPendientes} tarea(s) obligatoria(s) pendiente(s)`}
                    className="inline-flex items-center text-red-600 font-bold"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={TOKENS.critico}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="font-semibold">{v.tareas.pct}%</span>
            </div>
            <BigProgress
              pct={v.tareas.pct}
              color={v.tareas.obligPendientes > 0 ? TOKENS.alerta : TOKENS.fresco}
            />
          </div>
        )}
      </div>

      {/* Flecha a la derecha */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={TOKENS.sub}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 ml-1"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
