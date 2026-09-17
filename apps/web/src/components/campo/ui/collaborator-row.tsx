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
      aria-label={`Ver detalle de ${v.nombre}`}
      className={`group relative flex min-h-20 w-full items-center gap-3 overflow-hidden rounded-lg border bg-surface-raised p-3 text-left transition-colors hover:bg-surface-soft active:bg-surface-soft ${className}`}
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-accent-ink opacity-60" aria-hidden="true" />
      {/* Avatar circular con iniciales */}
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-soft ft-display text-sm font-semibold tracking-wide text-foreground"
        style={{
          color: TOKENS.ink,
        }}
      >
        {v.iniciales}
      </div>

      {/* Cuerpo central */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className="ft-body min-w-0 truncate text-sm font-semibold leading-snug text-foreground"
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
            <span className="flex min-w-0 items-center gap-1">
                {v.tareas.completadas}/{v.tareas.total} tareas
                {v.tareas.obligPendientes > 0 && (
                  <span
                    title={`${v.tareas.obligPendientes} tarea(s) obligatoria(s) pendiente(s)`}
                      className="inline-flex items-center font-bold text-rose-700 dark:text-rose-300"
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
        className="ml-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
