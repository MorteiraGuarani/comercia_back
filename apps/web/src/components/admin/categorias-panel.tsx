"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { BotonEditar } from "@/components/boton-editar";
import { IconoMas } from "@/components/icono-mas";
import { Modal } from "@/components/modal";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import { mostrarToast } from "@/components/toast/toast-controller";
import { btnGhost, btnPrimary, errorBox, inputBase, labelBase } from "@/components/ui";
import type { Categoria } from "@/types/categoria";
import type { EmpresaCatalogo } from "@/types/producto";
import type { RespuestaPaginada } from "@/types/paginacion";

/** Superadmin: ABM de campo_categoria (pasos del asistente de pedidos) por empresa. */
export function CategoriasPanel() {
  const [empresa, setEmpresa] = useState<EmpresaCatalogo | null>(null);
  return (
    <section className="min-w-0 w-full space-y-4" aria-label="Categorías de pedidos">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Categorías de pedidos</h1>
        <p className="mt-1 text-sm text-muted">
          Tabla campo_categoria: los pasos del asistente de pedidos de cada empresa, en orden.
        </p>
      </div>
      <div className="min-w-0 sm:w-80 lg:w-96">
        <SelectorPaginado
          url="/admin/catalogo/empresas"
          etiqueta="Empresa"
          value={empresa?.id ?? ""}
          seleccionActual={empresa?.nombre}
          placeholder="Elegí una empresa"
          buscable
          required
          onChange={() => {}}
          onSeleccionar={(item) => setEmpresa({ id: item.id, nombre: item.nombre ?? "" })}
        />
      </div>
      {empresa ? (
        <CategoriasDeEmpresa key={empresa.id} empresa={empresa} />
      ) : (
        <div className="border border-dashed border-line px-4 py-12 text-center">
          <p className="font-semibold text-foreground">Elegí una empresa para empezar</p>
          <p className="mt-1 text-sm text-muted">Vas a ver y editar sus categorías.</p>
        </div>
      )}
    </section>
  );
}

type Form = { nombre_categoria: string; codesap: string; Modo: string; orden: string };
const FORM_INICIAL: Form = { nombre_categoria: "", codesap: "", Modo: "", orden: "0" };

function CategoriasDeEmpresa({ empresa }: { empresa: EmpresaCatalogo }) {
  const base = `/admin/empresas/${empresa.id}/categorias`;
  const [datos, setDatos] = useState<RespuestaPaginada<Categoria> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [editando, setEditando] = useState<Categoria | "nueva" | null>(null);
  const [form, setForm] = useState<Form>(FORM_INICIAL);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    apiFetch<RespuestaPaginada<Categoria>>(`${base}?page=${page}&limit=${limit}`)
      .then((r) => {
        setDatos(r);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "No se pudieron cargar las categorías"),
      );
  }, [base, page, limit]);

  useEffect(() => {
    const timer = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  function abrir(c: Categoria | "nueva") {
    setForm(
      c === "nueva"
        ? FORM_INICIAL
        : {
            nombre_categoria: c.nombre_categoria,
            codesap: c.codesap === null ? "" : String(c.codesap),
            Modo: c.Modo ?? "",
            orden: String(c.orden),
          },
    );
    setErrorForm(null);
    setEditando(c);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setProcesando("Guardando categoría");
    setErrorForm(null);
    try {
      await apiFetch(editando === "nueva" ? base : `${base}/${editando.id}`, {
        method: editando === "nueva" ? "POST" : "PATCH",
        body: JSON.stringify({
          nombre_categoria: form.nombre_categoria,
          // Vacío borra el dato: la API guarda null.
          codesap: form.codesap.trim() ? Number(form.codesap) : null,
          Modo: form.Modo.trim() || null,
          orden: Number(form.orden || 0),
        }),
      });
      setEditando(null);
      mostrarToast("exito", `Categoría ${form.nombre_categoria.trim()} guardada.`, "Listo");
      cargar();
    } catch (problema) {
      setErrorForm(problema instanceof ApiError ? problema.message : "No se pudo guardar la categoría");
    } finally {
      setProcesando(null);
    }
  }

  async function eliminar(c: Categoria) {
    if (
      !(await confirmar({
        titulo: "Eliminar categoría",
        mensaje: `¿Eliminar la categoría ${c.nombre_categoria} de ${empresa.nombre}? Esta acción no se puede deshacer.`,
        textoConfirmar: "Eliminar",
        peligro: true,
      }))
    )
      return;
    setProcesando("Eliminando categoría");
    try {
      await apiFetch(`${base}/${c.id}`, { method: "DELETE" });
      mostrarToast("exito", `Categoría ${c.nombre_categoria} eliminada.`, "Listo");
      // Si era la última de la página, volver a la anterior.
      if (datos && datos.items.length === 1 && page > 1) setPage(page - 1);
      else cargar();
    } catch (problema) {
      setError(problema instanceof ApiError ? problema.message : "No se pudo eliminar la categoría");
    } finally {
      setProcesando(null);
    }
  }

  const items = datos?.items ?? [];
  const acciones = (c: Categoria) => (
    <>
      <BotonEditar onClick={() => abrir(c)} etiqueta={`Editar categoría ${c.nombre_categoria}`} />
      <button
        type="button"
        onClick={() => void eliminar(c)}
        aria-label={`Eliminar categoría ${c.nombre_categoria}`}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 dark:text-red-300 dark:hover:bg-red-950"
      >
        Eliminar
      </button>
    </>
  );

  return (
    <div data-inicio-listado className="w-full min-w-0 scroll-mt-20">
      <PantallaCarga visible={!!procesando} mensaje={procesando ?? "Procesando"} />
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{empresa.nombre}</p>
        <button
          type="button"
          onClick={() => abrir("nueva")}
          aria-label="Crear categoría"
          title="Crear categoría"
          className={`${btnPrimary} h-11 w-11 shrink-0 p-0`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>

      {error ? <p className={`${errorBox} mt-4`}>{error}</p> : null}

      <ul className="mt-4 space-y-3 md:hidden" aria-label="Categorías">
        {items.map((c) => (
          <li key={c.id} className="rounded-xl border border-line bg-surface-raised p-4">
            <p className="font-semibold text-foreground">
              {c.orden}. {c.nombre_categoria}
            </p>
            <p className="mt-1 text-xs text-muted">
              Código SAP {c.codesap ?? "—"} · Modo {c.Modo ?? "—"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{acciones(c)}</div>
          </li>
        ))}
      </ul>

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-surface-raised md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Categorías de {empresa.nombre}</caption>
          <thead className="bg-surface-soft text-xs font-semibold uppercase text-foreground">
            <tr>
              <th className="px-4 py-3 text-center">Orden</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Código SAP</th>
              <th className="px-4 py-3">Modo</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-surface-soft">
                <td className="px-4 py-3 text-center">{c.orden}</td>
                <td className="px-4 py-3 font-semibold text-foreground">{c.nombre_categoria}</td>
                <td className="px-4 py-3">{c.codesap ?? "—"}</td>
                <td className="px-4 py-3">{c.Modo ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">{acciones(c)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {datos && !datos.total && !error ? (
        <p className="mt-4 text-sm text-muted">Esta empresa todavía no tiene categorías.</p>
      ) : null}
      {datos?.total ? (
        <Paginacion
          page={datos.page}
          totalPages={datos.totalPages}
          total={datos.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      ) : null}

      <Modal
        titulo={editando === "nueva" ? "Crear categoría" : "Editar categoría"}
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
      >
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <label className={labelBase}>
            Nombre de la categoría
            <input
              value={form.nombre_categoria}
              onChange={(e) => setForm((f) => ({ ...f, nombre_categoria: e.target.value }))}
              maxLength={100}
              required
              pattern=".*\S.*"
              placeholder="Ej.: Hamburguesas"
              className={inputBase}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={labelBase}>
              Código SAP (opcional)
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={form.codesap}
                onChange={(e) => setForm((f) => ({ ...f, codesap: e.target.value }))}
                placeholder="Ej.: 144"
                className={inputBase}
              />
            </label>
            <label className={labelBase}>
              Modo (opcional)
              <input
                value={form.Modo}
                onChange={(e) => setForm((f) => ({ ...f, Modo: e.target.value }))}
                maxLength={1}
                placeholder="Ej.: T"
                className={inputBase}
              />
            </label>
            <label className={labelBase}>
              Orden
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={form.orden}
                onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
                required
                className={inputBase}
              />
            </label>
          </div>
          {errorForm ? <p className={errorBox}>{errorForm}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(null)} className={btnGhost}>
              Cancelar
            </button>
            <button type="submit" disabled={!!procesando} className={btnPrimary}>
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
