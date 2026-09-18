"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaEnZonaIso } from "@/utils/fechas";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import {
  IconoEquipo,
  IconoRefrescar,
  IconoCruz,
  IconoCalendario,
} from "./ui/iconos-campo";
import type {
  AsignacionCampo,
  BackupCampo,
  FormHorarioCampo,
  HorarioCampo,
  LocalCampo,
} from "@/types/campo";

export function PlanLocal({
  local,
  cerrar,
}: {
  local: LocalCampo;
  cerrar: () => void;
}) {
  const [vista, setVista] = useState<"horarios" | "equipo">("horarios");

  return (
    <Modal
      titulo={`Planificación Operativa · ${local.nombre}`}
      abierto
      onCerrar={cerrar}
      ancho="xl"
    >
      <div className="campo-screen space-y-5">
        {/* Banner de Contexto */}
        <div
          className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2"
          style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#726C60]">
              Cuenta Comercial
            </span>
            <p className="text-sm font-bold text-[#1E2320]">
              {local.cliente.nombre} — {local.direccion || "Sin dirección fijada"}
            </p>
          </div>
          <StatusStamp tone="frio" size="sm">
            PLANIFICACIÓN
          </StatusStamp>
        </div>

        {/* Segmented Tab Selector */}
        <div className="flex gap-2 border-b pb-3" style={{ borderColor: TOKENS.line }}>
          <button
            type="button"
            onClick={() => setVista("horarios")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              vista === "horarios"
                ? "bg-[#1E2320] text-white shadow-sm"
                : "bg-white text-[#726C60] hover:text-[#1E2320] border"
            }`}
            style={{ borderColor: vista === "horarios" ? "transparent" : TOKENS.line }}
          >
            ⏰ Horarios & Franjas de Visita
          </button>
          <button
            type="button"
            onClick={() => setVista("equipo")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5 ${
              vista === "equipo"
                ? "bg-[#1E2320] text-white shadow-sm"
                : "bg-white text-[#726C60] hover:text-[#1E2320] border"
            }`}
            style={{ borderColor: vista === "equipo" ? "transparent" : TOKENS.line }}
          >
            <IconoEquipo className="w-3.5 h-3.5" />
            <span>Equipo Titular & Reemplazos</span>
          </button>
        </div>

        {/* Contenido según pestaña */}
        {vista === "horarios" ? (
          <HorariosLocal localId={local.id} />
        ) : (
          <AsignacionesLocal localId={local.id} />
        )}
      </div>
    </Modal>
  );
}

// ========== PESTAÑA: HORARIOS Y FRANJAS ==========

function HorariosLocal({ localId }: { localId: number }) {
  const lista = useListaCampo<HorarioCampo>(`/campo/locales/${localId}/horarios`);
  const op = useOperacionCampo();
  const [form, setForm] = useState<FormHorarioCampo | null>(null);
  const [id, setId] = useState(0);

  function abrir(h?: HorarioCampo) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#1E2320]">
            Franjas de Atención ({lista.items.length})
          </h4>
          <p className="text-xs text-[#726C60]">
            Cada franja define una visita requerida. Sin franjas, se permite una visita diaria libre.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrir()}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110"
          style={{ backgroundColor: TOKENS.carne }}
        >
          + Agregar Franja
        </button>
      </div>

      {/* Lista de Franjas */}
      {lista.items.length === 0 ? (
        <div
          className="p-8 text-center rounded-xl border"
          style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
        >
          <p className="text-sm font-bold text-[#1E2320]">No hay horarios configurados</p>
          <p className="text-xs text-[#726C60] mt-1">
            Los impulsadores podrán registrar presencia libremente en cualquier momento del día.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.items.map((h) => (
            <div
              key={h.id}
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-lg font-bold text-[#1E2320] tracking-tight">
                    {h.entrada} — {h.salida}
                  </span>
                  <StatusStamp tone="frio" size="sm">
                    {h.frecuencia}
                  </StatusStamp>
                </div>

                {/* Días activos */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {h.frecuencia === "MENSUAL" ? (
                    <span className="text-xs font-mono text-[#726C60]">
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
                              ? "bg-[#1E2320] text-white"
                              : "bg-[#ECE9E2] text-[#726C60]/50"
                          }`}
                        >
                          {dNom}
                        </span>
                      );
                    })
                  )}
                </div>

                <p className="text-[11px] font-mono text-[#726C60]">
                  Vigencia: {h.fechaDesde.slice(0, 10)} {h.fechaHasta ? `hasta ${h.fechaHasta.slice(0, 10)}` : "· Sin vencimiento"}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t mt-3" style={{ borderColor: TOKENS.line }}>
                <button
                  type="button"
                  onClick={() => abrir(h)}
                  className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border bg-white hover:bg-gray-50"
                  style={{ borderColor: TOKENS.line }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void op.ejecutar("Quitando horario", async () => {
                      await apiFetch(`/campo/locales/${localId}/horarios/${h.id}`, {
                        method: "DELETE",
                      });
                      lista.refrescar();
                    })
                  }
                  className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                >
                  Quitar
                </button>
              </div>
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
              await op.ejecutar(id ? "Guardando horario" : "Creando horario", () =>
                apiFetch(`/campo/locales/${localId}/horarios${id ? `/${id}` : ""}`, {
                  method: id ? "PUT" : "POST",
                  body: JSON.stringify(form),
                }),
              )
            ) {
              setForm(null);
              lista.refrescar();
            }
          }}
          className="p-5 rounded-xl border space-y-4 bg-white shadow-sm mt-4"
          style={{ borderColor: TOKENS.line }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: TOKENS.line }}>
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#1E2320]">
              {id ? "Editar Franja Horaria" : "Nueva Franja Horaria"}
            </h5>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-xs font-bold text-[#726C60] hover:text-[#1E2320] inline-flex items-center gap-1 cursor-pointer"
            >
              <IconoCruz className="w-3 h-3" />
              <span>Cerrar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Frecuencia
              </label>
              <select
                value={form.frecuencia}
                onChange={(e) =>
                  setForm({
                    ...form,
                    frecuencia: e.target.value as FormHorarioCampo["frecuencia"],
                  })
                }
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              >
                <option value="DIARIA">Diaria</option>
                <option value="SEMANAL">Semanal</option>
                <option value="MENSUAL">Mensual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Repetir cada (intervalo)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={form.intervalo}
                onChange={(e) => setForm({ ...form, intervalo: Number(e.target.value) })}
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
          </div>

          {/* Días de la semana si es semanal */}
          {form.frecuencia === "SEMANAL" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1.5">
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
                          ? "bg-[#1E2320] text-white shadow-sm"
                          : "bg-[#ECE9E2] text-[#726C60] hover:bg-[#DAD5C9]"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Hora Inicio (Entrada) *
              </label>
              <input
                type="time"
                required
                value={form.entrada}
                onChange={(e) => setForm({ ...form, entrada: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Hora Límite (Salida) *
              </label>
              <input
                type="time"
                required
                value={form.salida}
                onChange={(e) => setForm({ ...form, salida: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
          </div>

          {/* Fechas de vigencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Fecha Desde *
              </label>
              <input
                type="date"
                required
                value={form.fechaDesde}
                onChange={(e) => setForm({ ...form, fechaDesde: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Fecha Hasta (Opcional)
              </label>
              <input
                type="date"
                value={form.fechaHasta}
                onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: TOKENS.line }}>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-white"
              style={{ borderColor: TOKENS.line }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!!op.mensaje}
              className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:brightness-110"
              style={{ backgroundColor: TOKENS.ink }}
            >
              {op.mensaje ? "Guardando..." : "Guardar Franja"}
            </button>
          </div>
        </form>
      )}

      {op.error && (
        <div className="p-3 rounded-lg border text-xs font-medium text-red-700 bg-red-50 border-red-200">
          {op.error}
        </div>
      )}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje ?? "Procesando"} />
    </div>
  );
}

// ========== PESTAÑA: ASIGNACIONES Y BACKUPS ==========

function AsignacionesLocal({ localId }: { localId: number }) {
  const lista = useListaCampo<AsignacionCampo>(`/campo/locales/${localId}/asignaciones`);
  const op = useOperacionCampo();
  const [crear, setCrear] = useState(false);
  const [usuarioId, setUsuarioId] = useState<number | "">("");
  const [desde, setDesde] = useState(fechaEnZonaIso(new Date()));
  const [hasta, setHasta] = useState("");
  const [backup, setBackup] = useState<AsignacionCampo | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#1E2320]">
            Impulsadores Asignados ({lista.items.length})
          </h4>
          <p className="text-xs text-[#726C60]">
            Colaboradores titulares encargados de atender este punto de venta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCrear(true);
            setUsuarioId("");
          }}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110"
          style={{ backgroundColor: TOKENS.carne }}
        >
          + Asignar Colaborador
        </button>
      </div>

      {lista.items.length === 0 ? (
        <div
          className="p-8 text-center rounded-xl border"
          style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
        >
          <p className="text-sm font-bold text-[#1E2320]">Sin titular asignado</p>
          <p className="text-xs text-[#726C60] mt-1">
            Asigna un impulsador a este local para que aparezca en su hoja de ruta diaria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.items.map((a) => (
            <div
              key={a.id}
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border"
                      style={{
                        backgroundColor: TOKENS.bone,
                        borderColor: TOKENS.line,
                        color: TOKENS.ink,
                      }}
                    >
                      {a.usuario.nombre[0]}
                      {a.usuario.apellido ? a.usuario.apellido[0] : ""}
                    </div>
                    <div>
                      <strong className="block text-sm text-[#1E2320] leading-tight">
                        {a.usuario.nombre} {a.usuario.apellido}
                      </strong>
                      <span className="text-[11px] font-mono text-[#726C60]">
                        Desde {a.fechaDesde.slice(0, 10)} {a.fechaHasta ? `hasta ${a.fechaHasta.slice(0, 10)}` : "· Indefinido"}
                      </span>
                    </div>
                  </div>

                  <StatusStamp tone={a.activo ? "fresco" : "sub"} size="sm">
                    {a.activo ? "TITULAR" : "INACTIVO"}
                  </StatusStamp>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t mt-3" style={{ borderColor: TOKENS.line }}>
                <button
                  type="button"
                  onClick={() => setBackup(a)}
                  className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border bg-white hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                  style={{ borderColor: TOKENS.line }}
                >
                  <IconoRefrescar className="w-3.5 h-3.5" />
                  <span>Gestionar Reemplazos</span>
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
                  className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
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
                apiFetch(`/campo/locales/${localId}/asignaciones`, {
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
          className="p-5 rounded-xl border space-y-4 bg-white shadow-sm mt-4"
          style={{ borderColor: TOKENS.line }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: TOKENS.line }}>
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#1E2320]">
              Asignar Impulsador Titular
            </h5>
            <button
              type="button"
              onClick={() => setCrear(false)}
              className="text-xs font-bold text-[#726C60] hover:text-[#1E2320] inline-flex items-center gap-1 cursor-pointer"
            >
              <IconoCruz className="w-3 h-3" />
              <span>Cerrar</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
              Seleccionar Colaborador *
            </label>
            <SelectorPaginado
              url="/campo/subordinados"
              etiqueta="Colaborador"
              value={usuarioId}
              onChange={(val: number | "") => setUsuarioId(val)}
              buscable
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Fecha Desde *
              </label>
              <input
                type="date"
                required
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Fecha Hasta (Opcional)
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: TOKENS.line }}>
            <button
              type="button"
              onClick={() => setCrear(false)}
              className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-white"
              style={{ borderColor: TOKENS.line }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!usuarioId || !!op.mensaje}
              className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
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

      {op.error && (
        <div className="p-3 rounded-lg border text-xs font-medium text-red-700 bg-red-50 border-red-200">
          {op.error}
        </div>
      )}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje ?? "Procesando"} />
    </div>
  );
}

// ========== MODAL DE REEMPLAZOS (BACKUPS) ==========

function ModalBackups({
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
        <p className="text-xs text-[#726C60]">
          Designa suplentes temporales para cubrir licencias, vacaciones o refuerzos puntuales.
        </p>

        <div className="flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1E2320]">
            Suplentes Registrados ({lista.items.length})
          </span>
          <button
            type="button"
            onClick={() => setCrear(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: TOKENS.ink }}
          >
            + Agregar Suplente
          </button>
        </div>

        {lista.items.length === 0 ? (
          <div
            className="p-6 text-center rounded-xl border"
            style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
          >
            <p className="text-sm font-semibold text-[#1E2320]">Sin reemplazos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.items.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
                style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-[#1E2320]">
                      {b.usuario.nombre} {b.usuario.apellido}
                    </strong>
                    <StatusStamp tone="alerta" size="sm">
                      REEMPLAZO
                    </StatusStamp>
                  </div>
                  <p className="text-xs text-[#726C60] mt-0.5">
                    Motivo: <span className="text-[#1E2320] font-medium">{b.motivo}</span>
                  </p>
                  <p className="text-[11px] font-mono text-[#726C60]">
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
                  className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200"
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
            className="p-4 rounded-xl border space-y-3 bg-white shadow-sm mt-3"
            style={{ borderColor: TOKENS.line }}
          >
            <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: TOKENS.line }}>
              <h6 className="text-xs font-bold uppercase tracking-wider text-[#1E2320]">
                Nuevo Reemplazo
              </h6>
              <button
                type="button"
                onClick={() => setCrear(false)}
                className="text-xs font-bold text-[#726C60] hover:text-[#1E2320] p-0.5 cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Colaborador Suplente *
              </label>
              <SelectorPaginado
                url="/campo/subordinados"
                etiqueta="Colaborador Suplente"
                value={usuarioId}
                onChange={(val: number | "") => setUsuarioId(val)}
                buscable
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
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
                <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  required
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full p-2 rounded-lg border text-sm font-mono"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
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

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: TOKENS.line }}>
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
                className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: TOKENS.ink }}
              >
                Guardar Suplente
              </button>
            </div>
          </form>
        )}

        <div className="flex justify-end pt-3 border-t" style={{ borderColor: TOKENS.line }}>
          <button
            type="button"
            onClick={cerrar}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: TOKENS.ink }}
          >
            Finalizar
          </button>
        </div>
      </div>
    </Modal>
  );
}
