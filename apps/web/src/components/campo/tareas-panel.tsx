"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaEnZonaIso } from "@/utils/fechas";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { btnGhost, errorBox } from "@/components/ui";
import { TablaCampo } from "./tabla-campo";
import {
  BotonesFormulario,
  CabeceraCampo,
  CampoActivo,
  CampoTexto,
} from "./form-campo";
import type { FormTareaCampo, TareaCampo } from "@/types/campo";

export function TareasPanel() {
  const lista = useListaCampo<TareaCampo>("/campo/tareas");
  const op = useOperacionCampo();
  const [id, setId] = useState(0);
  const [form, setForm] = useState<FormTareaCampo | null>(null);
  function abrir(t?: TareaCampo) {
    setId(t?.id ?? 0);
    op.limpiarError();
    setForm({
      nombre: t?.nombre ?? "",
      descripcion: t?.descripcion ?? "",
      todosLocales: t?.todosLocales ?? true,
      activo: t?.activo ?? true,
      fechaDesde: t?.fechaDesde.slice(0, 10) ?? fechaEnZonaIso(new Date()),
      fechaHasta: t?.fechaHasta?.slice(0, 10) ?? "",
      localIds: t?.locales.map((x) => x.local.id) ?? [],
      requiereFotos: t?.requiereFotos ?? false,
      fotosObligatorias: t?.fotosObligatorias ?? false,
    });
  }
  return (
    <>
      <CabeceraCampo
        titulo="Tareas"
        detalle="Por defecto se aplican a todos los locales de la empresa, incluidos los futuros. Se realizan en cada visita durante su vigencia."
        crear={() => abrir()}
      />
      <TablaCampo
        lista={lista}
        etiqueta="Tareas"
        columnas={[
          { titulo: "Tarea", valor: (t) => t.nombre },
          {
            titulo: "Alcance",
            valor: (t) =>
              t.todosLocales
                ? "Todos los locales"
                : t.locales.map((x) => x.local.nombre).join(", "),
          },
          {
            titulo: "Vigencia",
            valor: (t) =>
              `${t.fechaDesde.slice(0, 10)} · ${t.fechaHasta?.slice(0, 10) ?? "Sin fin"}`,
          },
          {
            titulo: "Fotos",
            valor: (t) => 
              t.requiereFotos 
                ? (t.fotosObligatorias ? "Obligatorias" : "Opcionales")
                : "No",
          },
          {
            titulo: "Estado",
            valor: (t) => (t.activo ? "Activa" : "Inactiva"),
          },
        ]}
        acciones={(t) => (
          <button className={btnGhost} onClick={() => abrir(t)}>
            Editar
          </button>
        )}
      />
      <Modal
        titulo={id ? "Editar tarea" : "Crear tarea"}
        abierto={!!form}
        onCerrar={() => {
          if (!op.mensaje) setForm(null);
        }}
      >
        {form ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await op.ejecutar("Guardando tarea", () =>
                  apiFetch(`/campo/tareas${id ? `/${id}` : ""}`, {
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify({
                      ...form,
                      fechaHasta: form.fechaHasta || null,
                    }),
                  }),
                )
              ) {
                setForm(null);
                lista.refrescar();
              }
            }}
          >
            <CampoTexto
              titulo="Nombre"
              value={form.nombre}
              required
              onChange={(nombre) => setForm({ ...form, nombre })}
            />
            <CampoTexto
              titulo="Descripción"
              value={form.descripcion}
              maxLength={1000}
              onChange={(descripcion) => setForm({ ...form, descripcion })}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoTexto
                titulo="Desde"
                type="date"
                required
                value={form.fechaDesde}
                onChange={(fechaDesde) => setForm({ ...form, fechaDesde })}
              />
              <CampoTexto
                titulo="Hasta (opcional)"
                type="date"
                value={form.fechaHasta}
                onChange={(fechaHasta) => setForm({ ...form, fechaHasta })}
              />
            </div>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={form.todosLocales}
                onChange={(e) =>
                  setForm({
                    ...form,
                    todosLocales: e.target.checked,
                    localIds: [],
                  })
                }
              />
              Todos los locales de mi empresa
            </label>
            {!form.todosLocales ? (
              <>
                <SelectorPaginado
                  url="/campo/locales"
                  etiqueta="Agregar local"
                  value=""
                  onChange={(v) => {
                    if (v && !form.localIds.includes(v))
                      setForm({ ...form, localIds: [...form.localIds, v] });
                  }}
                />
                <p className="text-xs text-muted">
                  {form.localIds.length} locales seleccionados (máximo 50).
                </p>
                <div className="flex flex-wrap gap-2">
                  {form.localIds.map((localId) => (
                    <button
                      type="button"
                      className={btnGhost}
                      key={localId}
                      onClick={() =>
                        setForm({
                          ...form,
                          localIds: form.localIds.filter((x) => x !== localId),
                        })
                      }
                    >
                      Local #{localId} ×
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <div className="space-y-3 rounded-lg border border-gray-300 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-800">
              <p className="font-medium text-sm text-gray-900 dark:text-white">
                Configuración de fotos
              </p>
              <label className="flex min-h-11 items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiereFotos}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requiereFotos: e.target.checked,
                      fotosObligatorias: e.target.checked ? form.fotosObligatorias : false,
                    })
                  }
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Requiere fotos antes y después
                </span>
              </label>
              {form.requiereFotos && (
                <label className="flex min-h-11 items-center gap-2 ml-6 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.fotosObligatorias}
                    onChange={(e) =>
                      setForm({ ...form, fotosObligatorias: e.target.checked })
                    }
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Fotos obligatorias (no puede completar sin ambas fotos)
                  </span>
                </label>
              )}
            </div>
            <CampoActivo
              value={form.activo}
              onChange={(activo) => setForm({ ...form, activo })}
            />
            {op.error ? <p className={errorBox}>{op.error}</p> : null}
            <BotonesFormulario
              ocupado={!!op.mensaje}
              cancelar={() => setForm(null)}
            />
          </form>
        ) : null}
      </Modal>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </>
  );
}
