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
import type { FormHorarioCampo, HorarioCampo } from "@/types/campo";

// Horarios de atención de un local, generales o por asignación.

const DIAS_NOMBRE = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const UNIDAD = { DIARIA: "día(s)", SEMANAL: "semana(s)", MENSUAL: "mes(es)" };
const etiqueta =
  "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted";
const campo =
  "w-full min-h-11 rounded-lg border bg-surface-raised p-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus";
const chipDia = (activo: boolean) =>
  `min-h-11 min-w-11 cursor-pointer rounded-lg px-3 font-mono text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
    activo
      ? "bg-foreground text-background hover:opacity-90"
      : "bg-surface-soft text-muted hover:bg-line hover:text-foreground"
  }`;
const alternar = (lista: number[], valor: number) =>
  lista.includes(valor)
    ? lista.filter((d) => d !== valor)
    : [...lista, valor].sort((a, b) => a - b);

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
      diasMes: h?.diasMes?.length ? h.diasMes : [1],
      fechaDesde: h?.fechaDesde.slice(0, 10) ?? fechaEnZonaIso(new Date()),
      fechaHasta: h?.fechaHasta?.slice(0, 10) ?? "",
      entrada: h?.entrada ?? "08:00",
      salida: h?.salida ?? "17:00",
    });
  }

  const avisos = (
    <>
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
    </>
  );

  // Crear o editar una franja abre una vista propia dentro del modal, en vez de
  // un formulario al final de la lista; "← Franjas" vuelve sin guardar.
  if (form) {
    const sinDias =
      (form.frecuencia === "SEMANAL" && form.diasSemana.length === 0) ||
      (form.frecuencia === "MENSUAL" && form.diasMes.length === 0);
    return (
      <div className="space-y-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (sinDias) return;
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
          className="space-y-5"
        >
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="-ml-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span aria-hidden="true">←</span>
              {asignacionId ? "Franjas propias" : "Franjas predeterminadas"}
            </button>
            <h3 className="text-lg font-bold text-foreground">
              {id
                ? `Editar franja ${form.entrada} – ${form.salida}`
                : "Nueva franja"}
            </h3>
          </div>

          <fieldset
            className="min-w-0 space-y-3 rounded-xl border p-4"
            style={{ borderColor: TOKENS.line }}
          >
            <legend className="px-1 text-sm font-bold text-foreground">
              Cuándo se visita
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="franja-frecuencia" className={etiqueta}>
                  Frecuencia
                </label>
                <select
                  id="franja-frecuencia"
                  autoFocus
                  value={form.frecuencia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      frecuencia: e.target
                        .value as FormHorarioCampo["frecuencia"],
                    })
                  }
                  className={`${campo} font-sans`}
                  style={{ borderColor: TOKENS.line }}
                >
                  <option value="DIARIA">Diaria</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="MENSUAL">Mensual</option>
                </select>
              </div>
              <div>
                <label htmlFor="franja-intervalo" className={etiqueta}>
                  Repetir cada
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="franja-intervalo"
                    type="number"
                    min={1}
                    max={52}
                    required
                    value={form.intervalo}
                    onChange={(e) =>
                      setForm({ ...form, intervalo: Number(e.target.value) })
                    }
                    className={`${campo} max-w-24`}
                    style={{ borderColor: TOKENS.line }}
                  />
                  <span className="text-sm text-muted">
                    {UNIDAD[form.frecuencia]}
                  </span>
                </div>
              </div>
            </div>

            {form.frecuencia === "SEMANAL" && (
              <div role="group" aria-labelledby="franja-dias-semana">
                <p id="franja-dias-semana" className={etiqueta}>
                  Días de la semana
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIAS_NOMBRE.map((dNom, idx) => {
                    const seleccionado = form.diasSemana.includes(idx + 1);
                    return (
                      <button
                        key={dNom}
                        type="button"
                        aria-pressed={seleccionado}
                        onClick={() =>
                          setForm({
                            ...form,
                            diasSemana: alternar(form.diasSemana, idx + 1),
                          })
                        }
                        className={chipDia(seleccionado)}
                      >
                        {dNom}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {form.frecuencia === "MENSUAL" && (
              <div role="group" aria-labelledby="franja-dias-mes">
                <p id="franja-dias-mes" className={etiqueta}>
                  Días del mes
                </p>
                <div className="grid grid-cols-7 gap-1.5 sm:max-w-md">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {
                    const seleccionado = form.diasMes.includes(dia);
                    return (
                      <button
                        key={dia}
                        type="button"
                        aria-pressed={seleccionado}
                        aria-label={`Día ${dia}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            diasMes: alternar(form.diasMes, dia),
                          })
                        }
                        className={`${chipDia(seleccionado)} px-0`}
                      >
                        {dia}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {sinDias && (
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Elegí al menos un día.
              </p>
            )}
          </fieldset>

          <fieldset
            className="min-w-0 space-y-3 rounded-xl border p-4"
            style={{ borderColor: TOKENS.line }}
          >
            <legend className="px-1 text-sm font-bold text-foreground">
              Horario
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="franja-entrada" className={etiqueta}>
                  Entrada *
                </label>
                <input
                  id="franja-entrada"
                  type="time"
                  required
                  value={form.entrada}
                  onChange={(e) =>
                    setForm({ ...form, entrada: e.target.value })
                  }
                  className={campo}
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
              <div>
                <label htmlFor="franja-salida" className={etiqueta}>
                  Salida (hora límite) *
                </label>
                <input
                  id="franja-salida"
                  type="time"
                  required
                  value={form.salida}
                  onChange={(e) => setForm({ ...form, salida: e.target.value })}
                  className={campo}
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>
          </fieldset>

          <fieldset
            className="min-w-0 space-y-3 rounded-xl border p-4"
            style={{ borderColor: TOKENS.line }}
          >
            <legend className="px-1 text-sm font-bold text-foreground">
              Vigencia
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="franja-desde" className={etiqueta}>
                  Desde *
                </label>
                <input
                  id="franja-desde"
                  type="date"
                  required
                  value={form.fechaDesde}
                  onChange={(e) =>
                    setForm({ ...form, fechaDesde: e.target.value })
                  }
                  className={campo}
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
              <div>
                <label htmlFor="franja-hasta" className={etiqueta}>
                  Hasta (opcional)
                </label>
                <input
                  id="franja-hasta"
                  type="date"
                  min={form.fechaDesde}
                  value={form.fechaHasta}
                  onChange={(e) =>
                    setForm({ ...form, fechaHasta: e.target.value })
                  }
                  className={campo}
                  style={{ borderColor: TOKENS.line }}
                />
                <p className="mt-1 text-xs text-muted">
                  Vacío: sin vencimiento.
                </p>
              </div>
            </div>
          </fieldset>

          <div
            className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"
            style={{ borderColor: TOKENS.line }}
          >
            <button
              type="button"
              onClick={() => setForm(null)}
              className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!!op.mensaje || sinDias}
              className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400"
            >
              {op.mensaje
                ? "Guardando…"
                : id
                  ? "Guardar cambios"
                  : "Crear franja"}
            </button>
          </div>
        </form>
        {avisos}
      </div>
    );
  }

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
          <button
            type="button"
            onClick={() => abrir()}
            className="mt-3 min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Agregar franja
          </button>
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

      {avisos}
    </div>
  );
}

// ========== PESTAÑA: ASIGNACIONES Y BACKUPS ==========
