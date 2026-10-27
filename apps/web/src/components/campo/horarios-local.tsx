"use client";
import React, { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { ToleranciasHorario } from "@/components/tolerancias-horario";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaEnZonaIso } from "@/utils/fechas";
import { BotonEditar } from "@/components/boton-editar";
import { PantallaCarga } from "@/components/pantalla-carga";
import { TOKENS, btnMasCampo } from "./tokens";
import { BotonEliminarCampo } from "./boton-eliminar-campo";
import { EncabezadoSeccion } from "./ui/encabezado-seccion";
import { StatusStamp } from "./ui/status-stamp";
import { IconoMas } from "@/components/icono-mas";
import { IconoCruz } from "./ui/iconos-campo";
import type { FormHorarioCampo, HorarioCampo } from "@/types/campo";

// Horarios de atención de un local, generales o por asignación.

// ========== PESTAÑA: HORARIOS Y FRANJAS ==========

export function HorariosLocal({
  localId,
  asignacionId,
  nota,
  onPendiente,
}: {
  localId: string;
  asignacionId?: number;
  /** Aclaración extra para el botón de información (ej.: el equipo). */
  nota?: ReactNode;
  /** Avisa si hay una franja abierta sin guardar. */
  onPendiente?: (pendiente: boolean) => void;
}) {
  const ruta = asignacionId
    ? `/campo/asignaciones/${asignacionId}/horarios`
    : `/campo/locales/${encodeURIComponent(localId)}/horarios`;
  const lista = useListaCampo<HorarioCampo>(ruta);
  const op = useOperacionCampo();
  const [form, setForm] = useState<FormHorarioCampo | null>(null);
  const [id, setId] = useState(0);
  const [quitando, setQuitando] = useState<number | null>(null);
  useEffect(() => onPendiente?.(form !== null), [form, onPendiente]);

  function abrir(h?: HorarioCampo) {
    op.limpiarError();
    setId(h?.id ?? 0);
    setForm({
      frecuencia: h?.frecuencia ?? "SEMANAL",
      intervalo: h?.intervalo ?? 1,
      diasSemana: h?.diasSemana ?? [1, 2, 3, 4, 5],
      diasMes: h?.diasMes ?? [1],
      fechaDesde: h?.fechaDesde.slice(0, 10) ?? fechaEnZonaIso(new Date()),
      fechaHasta: h?.fechaHasta?.slice(0, 10) ?? "",
      entrada: h?.entrada ?? "08:00",
      salida: h?.salida ?? "17:00",
    });
  }

  const DIAS_NOMBRE = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-4">
      <EncabezadoSeccion
        titulo={`${asignacionId ? "Franjas propias" : "Franjas predeterminadas"} (${lista.items.length})`}
        info={
          <>
            <p>
              {asignacionId
                ? "Estas franjas se aplican solo a este colaborador. Sin ellas se usan las predeterminadas del local."
                : "Se aplican a todos los colaboradores sin franjas propias."}
            </p>
            {nota ? <p>{nota}</p> : null}
          </>
        }
        accion={
          <button
            type="button"
            onClick={() => abrir()}
            aria-label="Agregar franja"
            title="Agregar franja"
            className={btnMasCampo}
          >
            <IconoMas />
          </button>
        }
      />

      {/* Lista de Franjas */}
      {lista.items.length === 0 ? (
        <div
          className="p-8 text-center rounded-xl border"
          style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
        >
          <p className="text-sm font-bold text-foreground">
            No hay horarios configurados
          </p>
          <p className="text-xs text-muted mt-1">
            Agregá la primera franja de visita.
          </p>
          {!form && (
            <button
              type="button"
              onClick={() => abrir()}
              className="mt-3 min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Agregar franja
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {lista.items.map((h) => (
            <div
              key={h.id}
              className="min-w-0 space-y-3 rounded-xl border p-3 sm:p-4"
              style={{
                backgroundColor: TOKENS.canvas,
                borderColor: TOKENS.line,
              }}
            >
              <div>
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-2">
                    <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                      {h.entrada} — {h.salida}
                    </span>
                    <StatusStamp tone="frio" size="sm">
                      {h.frecuencia}
                    </StatusStamp>
                  </div>
                  {quitando === h.id ? null : (
                    <div className="flex shrink-0 items-center">
                      <BotonEditar
                        onClick={() => abrir(h)}
                        etiqueta={`Editar franja ${h.entrada} a ${h.salida}`}
                        className="md:h-11 md:w-11"
                      />
                      <BotonEliminarCampo
                        onClick={() => setQuitando(h.id)}
                        etiqueta={`Quitar franja ${h.entrada} a ${h.salida}`}
                      />
                    </div>
                  )}
                </div>
                {quitando === h.id ? (
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-900 dark:bg-red-950/50">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                      ¿Quitar esta franja?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setQuitando(null)}
                        className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void op.ejecutar("Quitando horario", async () => {
                            await apiFetch(`${ruta}/${h.id}`, {
                              method: "DELETE",
                            });
                            setQuitando(null);
                            lista.refrescar();
                          })
                        }
                        className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-red-800 dark:hover:bg-red-700"
                      >
                        Sí, quitar
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Días activos */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {h.frecuencia === "MENSUAL" ? (
                    <span className="text-xs font-mono text-muted">
                      Días del mes: {h.diasMes.join(", ")}
                    </span>
                  ) : (
                    DIAS_NOMBRE.map((dNom, idx) => {
                      const activo = h.diasSemana.includes(idx + 1);
                      return (
                        <span
                          key={dNom}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            activo
                              ? "bg-foreground text-background"
                              : "bg-surface-soft text-[#726C60]/50"
                          }`}
                        >
                          {dNom}
                        </span>
                      );
                    })
                  )}
                </div>

                <p className="text-[11px] font-mono text-muted">
                  Vigencia: {h.fechaDesde.slice(0, 10)}{" "}
                  {h.fechaHasta
                    ? `hasta ${h.fechaHasta.slice(0, 10)}`
                    : "· Sin vencimiento"}
                </p>
              </div>

              <ToleranciasHorario
                alcance="horario"
                id={h.id}
                titulo="Tolerancias"
              />
            </div>
          ))}
        </div>
      )}

      {/* Formulario de Franja */}
      {form && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await op.ejecutar(
                id ? "Guardando horario" : "Creando horario",
                () =>
                  apiFetch(`${ruta}${id ? `/${id}` : ""}`, {
                    method: id ? "PUT" : "POST",
                    // Un input date vacío llega como ""; el contrato de la API
                    // usa null para representar una vigencia sin vencimiento.
                    body: JSON.stringify({
                      ...form,
                      fechaHasta: form.fechaHasta?.trim()
                        ? form.fechaHasta.slice(0, 10)
                        : null,
                    }),
                  }),
              )
            ) {
              setForm(null);
              lista.refrescar();
            }
          }}
          className="p-5 rounded-xl border space-y-4 bg-surface-raised shadow-sm mt-4"
          style={{ borderColor: TOKENS.line }}
        >
          <div
            className="flex min-w-0 items-start justify-between gap-3 border-b pb-2"
            style={{ borderColor: TOKENS.line }}
          >
            <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {id ? "Editar Franja Horaria" : "Nueva Franja Horaria"}
            </h5>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-xs font-bold text-muted hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
            >
              <IconoCruz className="w-3 h-3" />
              <span>Cerrar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Frecuencia
              </label>
              <select
                value={form.frecuencia}
                onChange={(e) =>
                  setForm({
                    ...form,
                    frecuencia: e.target
                      .value as FormHorarioCampo["frecuencia"],
                  })
                }
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-sans focus:outline-none focus:ring-2 focus:ring-focus"
                style={{ borderColor: TOKENS.line }}
              >
                <option value="DIARIA">Diaria</option>
                <option value="SEMANAL">Semanal</option>
                <option value="MENSUAL">Mensual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Repetir cada (intervalo)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={form.intervalo}
                onChange={(e) =>
                  setForm({ ...form, intervalo: Number(e.target.value) })
                }
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-mono focus:outline-none focus:ring-2 focus:ring-focus"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
          </div>

          {/* Días de la semana si es semanal */}
          {form.frecuencia === "SEMANAL" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                Días de Visita de la Semana
              </label>
              <div className="flex flex-wrap gap-2">
                {DIAS_NOMBRE.map((dNom, idx) => {
                  const numDia = idx + 1;
                  const seleccionado = form.diasSemana.includes(numDia);
                  return (
                    <button
                      key={dNom}
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          diasSemana: seleccionado
                            ? form.diasSemana.filter((d) => d !== numDia)
                            : [...form.diasSemana, numDia].sort(),
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                        seleccionado
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-surface-soft text-muted hover:bg-surface-soft"
                      }`}
                    >
                      {dNom}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Horas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Hora Inicio (Entrada) *
              </label>
              <input
                type="time"
                required
                value={form.entrada}
                onChange={(e) => setForm({ ...form, entrada: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-mono focus:outline-none focus:ring-2 focus:ring-focus"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Hora Límite (Salida) *
              </label>
              <input
                type="time"
                required
                value={form.salida}
                onChange={(e) => setForm({ ...form, salida: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-mono focus:outline-none focus:ring-2 focus:ring-focus"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
          </div>

          {/* Fechas de vigencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Fecha Desde *
              </label>
              <input
                type="date"
                required
                value={form.fechaDesde}
                onChange={(e) =>
                  setForm({ ...form, fechaDesde: e.target.value })
                }
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
                min={form.fechaDesde}
                value={form.fechaHasta}
                onChange={(e) =>
                  setForm({ ...form, fechaHasta: e.target.value })
                }
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
              onClick={() => setForm(null)}
              className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-surface-raised"
              style={{ borderColor: TOKENS.line }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!!op.mensaje}
              className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-background shadow-sm transition-all hover:brightness-110"
              style={{ backgroundColor: TOKENS.ink }}
            >
              {op.mensaje ? "Guardando..." : "Guardar Franja"}
            </button>
          </div>
        </form>
      )}

      {op.error && (
        <div
          role="alert"
          className="p-3 rounded-lg border text-xs font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900"
        >
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

// ========== PESTAÑA: ASIGNACIONES Y BACKUPS ==========
