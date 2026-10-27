"use client";
import React, { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { ToleranciasHorario } from "@/components/tolerancias-horario";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaEnZonaIso } from "@/utils/fechas";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { TOKENS, btnMasCampo } from "./tokens";
import { EncabezadoSeccion } from "./ui/encabezado-seccion";
import { StatusStamp } from "./ui/status-stamp";
import { IconoMas } from "@/components/icono-mas";
import { IconoRefrescar, IconoCruz } from "./ui/iconos-campo";
import type { AsignacionCampo, BackupCampo } from "@/types/campo";
import { HorariosLocal } from "./horarios-local";

// Responsables del local y sus reemplazos (backups).

export function AsignacionesLocal({
  localId,
  nota,
  onPendiente,
}: {
  localId: string;
  /** Aclaración extra para el botón de información (ej.: el equipo). */
  nota?: ReactNode;
  /** Avisa si eligieron un colaborador y falta confirmar la asignación. */
  onPendiente?: (pendiente: boolean) => void;
}) {
  const lista = useListaCampo<AsignacionCampo>(
    `/campo/locales/${encodeURIComponent(localId)}/asignaciones`,
  );
  const op = useOperacionCampo();
  const [crear, setCrear] = useState(false);
  const [usuarioId, setUsuarioId] = useState<number | "">("");
  const [desde, setDesde] = useState(fechaEnZonaIso(new Date()));
  const [hasta, setHasta] = useState("");
  const [backup, setBackup] = useState<AsignacionCampo | null>(null);
  const [horariosDe, setHorariosDe] = useState<AsignacionCampo | null>(null);
  useEffect(
    () => onPendiente?.(crear && usuarioId !== ""),
    [crear, usuarioId, onPendiente],
  );

  return (
    <div className="space-y-4">
      <EncabezadoSeccion
        titulo={`Colaboradores asignados (${lista.items.length})`}
        info={
          <>
            <p>Colaboradores titulares encargados de atender este punto de venta.</p>
            {nota ? <p>{nota}</p> : null}
          </>
        }
        accion={
          <button
            type="button"
            onClick={() => {
              setCrear(true);
              setUsuarioId("");
            }}
            aria-label="Asignar colaborador"
            title="Asignar colaborador"
            className={btnMasCampo}
          >
            <IconoMas />
          </button>
        }
      />

      {lista.items.length === 0 ? (
        <div
          className="p-8 text-center rounded-xl border"
          style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
        >
          <p className="text-sm font-bold text-foreground">
            Sin titular asignado
          </p>
          <p className="text-xs text-muted mt-1">
            Asigná un impulsador o repositor para que aparezca en su ruta
            diaria.
          </p>
          {!crear && (
            <button
              type="button"
              onClick={() => {
                setCrear(true);
                setUsuarioId("");
              }}
              className="mt-3 min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Asignar colaborador
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.items.map((a) => (
            <div
              key={a.id}
              className="min-w-0 p-3 sm:p-4 rounded-xl border flex flex-col justify-between"
              style={{
                backgroundColor: TOKENS.canvas,
                borderColor: TOKENS.line,
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs border"
                      style={{
                        backgroundColor: TOKENS.bone,
                        borderColor: TOKENS.line,
                        color: TOKENS.ink,
                      }}
                    >
                      {a.usuario.nombre[0]}
                      {a.usuario.apellido ? a.usuario.apellido[0] : ""}
                    </div>
                    <div className="min-w-0 break-words">
                      <strong className="block text-sm text-foreground leading-tight">
                        {a.usuario.nombre} {a.usuario.apellido}
                      </strong>
                      <span className="text-[11px] font-mono text-muted">
                        Desde {a.fechaDesde.slice(0, 10)}{" "}
                        {a.fechaHasta
                          ? `hasta ${a.fechaHasta.slice(0, 10)}`
                          : "· Indefinido"}
                      </span>
                    </div>
                  </div>

                  <StatusStamp tone={a.activo ? "fresco" : "sub"} size="sm">
                    {a.activo ? "TITULAR" : "INACTIVO"}
                  </StatusStamp>
                </div>
              </div>

              <div
                className="grid min-w-0 grid-cols-2 gap-2 border-t pt-3 mt-3"
                style={{ borderColor: TOKENS.line }}
              >
                <button type="button" aria-pressed={a.usuario.localPrincipalId === localId}
                  title="Mostrar este local primero en Ucheck"
                  className="min-h-11 min-w-0 rounded-lg border border-line bg-surface-raised px-2 text-xs font-semibold text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus"
                  onClick={() => void op.ejecutar("Guardando local principal", async () => {
                    await apiFetch(`/campo/asignaciones/${a.id}/principal`, { method: "PUT", body: JSON.stringify({ principal: a.usuario.localPrincipalId !== localId }) });
                    lista.refrescar();
                  })}>
                  {a.usuario.localPrincipalId === localId ? "★ Principal" : "☆ Principal"}
                </button>
                <button
                  type="button"
                  onClick={() => setHorariosDe(a)}
                  aria-label={`Horarios de ${a.usuario.nombre} ${a.usuario.apellido}`}
                  className="min-h-11 min-w-0 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-2 text-xs font-semibold text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Horarios
                </button>
                <button
                  type="button"
                  onClick={() => setBackup(a)}
                  aria-label={`Reemplazos de ${a.usuario.nombre} ${a.usuario.apellido}`}
                  className="min-h-11 min-w-0 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-2 text-xs font-semibold text-foreground hover:bg-surface-soft flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <IconoRefrescar className="w-3.5 h-3.5" />
                  <span>Reemplazos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void op.ejecutar("Quitando asignación", async () => {
                      await apiFetch(`/campo/asignaciones/${a.id}`, {
                        method: "DELETE",
                      });
                      lista.refrescar();
                    })
                  }
                  aria-label={`Quitar asignación de ${a.usuario.nombre} ${a.usuario.apellido}`}
                  className="col-span-2 min-h-11 min-w-0 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-focus dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de Asignación */}
      {crear && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!usuarioId) return;
            if (
              await op.ejecutar("Asignando colaborador", () =>
                apiFetch(`/campo/locales/${encodeURIComponent(localId)}/asignaciones`, {
                  method: "POST",
                  body: JSON.stringify({
                    usuarioId,
                    fechaDesde: desde,
                    fechaHasta: hasta || null,
                  }),
                }),
              )
            ) {
              setCrear(false);
              lista.refrescar();
            }
          }}
          className="p-5 rounded-xl border space-y-4 bg-surface-raised shadow-sm mt-4"
          style={{ borderColor: TOKENS.line }}
        >
          <div
            className="flex items-center justify-between border-b pb-2"
            style={{ borderColor: TOKENS.line }}
          >
            <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Asignar colaborador titular
            </h5>
            <button
              type="button"
              onClick={() => setCrear(false)}
              className="text-xs font-bold text-muted hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
            >
              <IconoCruz className="w-3 h-3" />
              <span>Cerrar</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
              Seleccionar Colaborador *
            </label>
            <SelectorPaginado
              url="/campo/equipo"
              etiqueta="Colaborador"
              value={usuarioId}
              onChange={(val: number | "") => setUsuarioId(val)}
              buscable
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Fecha Desde *
              </label>
              <input
                type="date"
                required
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-mono focus:outline-none focus:ring-2 focus:ring-focus"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Fecha Hasta (Opcional)
              </label>
              <input
                type="date"
                min={desde}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-mono focus:outline-none focus:ring-2 focus:ring-focus"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
          </div>

          <div
            className="flex flex-col-reverse gap-2 pt-2 border-t sm:flex-row sm:justify-end"
            style={{ borderColor: TOKENS.line }}
          >
            <button
              type="button"
              onClick={() => setCrear(false)}
              className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-surface-raised"
              style={{ borderColor: TOKENS.line }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!usuarioId || !!op.mensaje}
              className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-background shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: TOKENS.ink }}
            >
              {op.mensaje ? "Asignando..." : "Confirmar Asignación"}
            </button>
          </div>
        </form>
      )}

      {/* Modal de Backups / Reemplazos */}
      {backup && (
        <ModalBackups
          asignacion={backup}
          cerrar={() => {
            setBackup(null);
            lista.refrescar();
          }}
        />
      )}
      {horariosDe && (
        <Modal
          titulo={`Horarios · ${horariosDe.usuario.nombre} ${horariosDe.usuario.apellido}`}
          abierto
          onCerrar={() => setHorariosDe(null)}
          ancho="xl"
        >
          <HorariosLocal localId={localId} asignacionId={horariosDe.id} />
          <ToleranciasHorario alcance="usuario" id={horariosDe.usuario.id} titulo="Tolerancias del usuario" />
        </Modal>
      )}

      {op.error && (
        <div className="p-3 rounded-lg border text-xs font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900">
          {op.error}
        </div>
      )}
      <PantallaCarga
        visible={!!op.mensaje}
        mensaje={op.mensaje ?? "Procesando"}
      />
    </div>
  );
}

// ========== MODAL DE REEMPLAZOS (BACKUPS) ==========

export function ModalBackups({
  asignacion,
  cerrar,
}: {
  asignacion: AsignacionCampo;
  cerrar: () => void;
}) {
  const lista = useListaCampo<BackupCampo>(
    `/campo/asignaciones/${asignacion.id}/backups`,
  );
  const op = useOperacionCampo();
  const [crear, setCrear] = useState(false);
  const [usuarioId, setUsuarioId] = useState<number | "">("");
  const [desde, setDesde] = useState(fechaEnZonaIso(new Date()));
  const [hasta, setHasta] = useState(fechaEnZonaIso(new Date()));
  const [motivo, setMotivo] = useState("");

  return (
    <Modal
      titulo={`Reemplazos Temporales · ${asignacion.usuario.nombre} ${asignacion.usuario.apellido}`}
      abierto
      onCerrar={cerrar}
      ancho="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          Designa suplentes temporales para cubrir licencias, vacaciones o
          refuerzos puntuales.
        </p>

        <div className="flex min-w-0 flex-wrap justify-between items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Suplentes Registrados ({lista.items.length})
          </span>
          <button
            type="button"
            onClick={() => setCrear(true)}
            aria-label="Agregar suplente"
            title="Agregar suplente"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-background"
            style={{ backgroundColor: TOKENS.ink }}
          >
            <IconoMas />
          </button>
        </div>

        {lista.items.length === 0 ? (
          <div
            className="p-6 text-center rounded-xl border"
            style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
          >
            <p className="text-sm font-semibold text-foreground">
              Sin reemplazos registrados
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.items.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
                style={{
                  backgroundColor: TOKENS.canvas,
                  borderColor: TOKENS.line,
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-foreground">
                      {b.usuario.nombre} {b.usuario.apellido}
                    </strong>
                    <StatusStamp tone="alerta" size="sm">
                      REEMPLAZO
                    </StatusStamp>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Motivo:{" "}
                    <span className="text-foreground font-medium">
                      {b.motivo}
                    </span>
                  </p>
                  <p className="text-[11px] font-mono text-muted">
                    {b.fechaDesde.slice(0, 10)} al {b.fechaHasta.slice(0, 10)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void op.ejecutar("Quitando reemplazo", async () => {
                      await apiFetch(
                        `/campo/asignaciones/${asignacion.id}/backups/${b.id}`,
                        { method: "DELETE" },
                      );
                      lista.refrescar();
                    })
                  }
                  className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 rounded border border-red-200 dark:border-red-900"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Formulario nuevo reemplazo */}
        {crear && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!usuarioId || !motivo.trim()) return;
              if (
                await op.ejecutar("Guardando reemplazo", () =>
                  apiFetch(`/campo/asignaciones/${asignacion.id}/backups`, {
                    method: "POST",
                    body: JSON.stringify({
                      usuarioId,
                      fechaDesde: desde,
                      fechaHasta: hasta,
                      motivo: motivo.trim(),
                    }),
                  }),
                )
              ) {
                setCrear(false);
                lista.refrescar();
              }
            }}
            className="p-4 rounded-xl border space-y-3 bg-surface-raised shadow-sm mt-3"
            style={{ borderColor: TOKENS.line }}
          >
            <div
              className="flex justify-between items-center border-b pb-2"
              style={{ borderColor: TOKENS.line }}
            >
              <h6 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Nuevo Reemplazo
              </h6>
              <button
                type="button"
                aria-label="Cerrar nuevo reemplazo"
                onClick={() => setCrear(false)}
                className="text-xs font-bold text-muted hover:text-foreground p-0.5 cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Colaborador Suplente *
              </label>
              <SelectorPaginado
                url="/campo/equipo"
                etiqueta="Colaborador Suplente"
                value={usuarioId}
                onChange={(val: number | "") => setUsuarioId(val)}
                buscable
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  required
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full p-2 rounded-lg border text-sm font-mono"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  min={desde}
                  required
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full p-2 rounded-lg border text-sm font-mono"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Motivo del Reemplazo *
              </label>
              <input
                type="text"
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Licencia médica, Vacaciones, Refuerzo..."
                className="w-full p-2.5 rounded-lg border text-sm"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            <div
              className="flex flex-col-reverse gap-2 pt-2 border-t sm:flex-row sm:justify-end"
              style={{ borderColor: TOKENS.line }}
            >
              <button
                type="button"
                onClick={() => setCrear(false)}
                className="px-3 py-1.5 rounded-lg border text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!usuarioId || !motivo.trim() || !!op.mensaje}
                className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-background"
                style={{ backgroundColor: TOKENS.ink }}
              >
                Guardar Suplente
              </button>
            </div>
          </form>
        )}

        <div
          className="flex justify-end pt-3 border-t"
          style={{ borderColor: TOKENS.line }}
        >
          <button
            type="button"
            onClick={cerrar}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-background"
            style={{ backgroundColor: TOKENS.ink }}
          >
            Finalizar
          </button>
        </div>
      </div>
    </Modal>
  );
}
