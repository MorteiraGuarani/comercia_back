"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SelectorPaginado } from "@/components/selector-paginado";
import { BotonEditar } from "@/components/boton-editar";
import { BotonEliminarCampo } from "@/components/campo/boton-eliminar-campo";
import { Modal } from "@/components/modal";
import { IconoMas } from "@/components/icono-mas";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  errorBox,
  inputBase,
  labelBase,
} from "@/components/ui";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import {
  formatearPrecio,
  datosProducto,
  formularioProducto,
} from "@/utils/precio-producto";
import type {
  EmpresaCatalogo,
  FormProducto,
  ProductoAdmin,
} from "@/types/producto";

const PRODUCTO_VACIO: FormProducto = {
  itemcode: "",
  itemname: "",
  iva: "",
  itmsgrpcode: "",
  itmsgrpnam: "",
  inventory: "N",
  pricelist: "",
  pricelistname: "",
  price: "",
  tipo: "",
};
const celda = "px-4 py-3 align-middle";
const encabezado =
  "px-4 py-3 text-left text-xs font-semibold text-muted dark:text-muted";
const pieModal =
  "flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end dark:border-line";

export function ProductosPanel() {
  const [empresa, setEmpresa] = useState<EmpresaCatalogo | null>(null);
  return (
    <section
      className="campo-screen min-w-0 w-full space-y-4"
      aria-label="Productos y precios"
    >
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
          onSeleccionar={(item) =>
            setEmpresa({ id: item.id, nombre: item.nombre ?? "" })
          }
        />
      </div>
      {empresa ? (
        <RegistrosCatalogo key={empresa.id} empresa={empresa} />
      ) : (
        <div className="border border-dashed border-line px-4 py-12 text-center dark:border-line">
          <p className="font-semibold text-foreground dark:text-foreground">
            Elegí una empresa para empezar
          </p>
          <p className="mt-1 text-sm text-muted dark:text-muted">
            Vas a ver sus artículos y precios por lista.
          </p>
        </div>
      )}
    </section>
  );
}

function RegistrosCatalogo({ empresa }: { empresa: EmpresaCatalogo }) {
  const base = `/admin/catalogo/empresas/${empresa.id}/productos`;
  const [busqueda, setBusqueda] = useState("");
  const [buscar, setBuscar] = useState("");
  const [lista, setLista] = useState("");
  const [pricelist, setPricelist] = useState("");
  const [revision, setRevision] = useState(0);
  const parametros = new URLSearchParams();
  if (buscar) parametros.set("buscar", buscar);
  if (pricelist !== "") parametros.set("pricelist", pricelist);
  const registros = useListaCampo<ProductoAdmin>(
    `${base}?${parametros}`,
    revision,
    7,
  );
  const { setPage } = registros;
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscar(busqueda.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, setPage]);

  const op = useOperacionCampo();
  const [form, setForm] = useState<FormProducto | null>(null);
  const [editando, setEditando] = useState<ProductoAdmin | null>(null);
  const [eliminando, setEliminando] = useState<ProductoAdmin | null>(null);
  function abrir(producto?: ProductoAdmin) {
    op.limpiarError();
    setEditando(producto ?? null);
    setForm(producto ? formularioProducto(producto) : { ...PRODUCTO_VACIO });
  }
  async function guardar() {
    if (!form) return;
    const ok = await op.ejecutar("Guardando artículo y precio", () =>
      apiFetch(`${base}${editando === null ? "" : `/${encodeURIComponent(editando.itemcode)}/${editando.pricelist}`}`, {
        method: editando === null ? "POST" : "PUT",
        body: JSON.stringify(datosProducto(form)),
      }),
    );
    if (ok) {
      setForm(null);
      setRevision((n) => n + 1);
    }
  }
  async function eliminar() {
    if (!eliminando) return;
    const ok = await op.ejecutar("Eliminando artículo de la lista", () =>
      apiFetch(`${base}/${encodeURIComponent(eliminando.itemcode)}/${eliminando.pricelist}`, { method: "DELETE" }),
    );
    if (ok) {
      setEliminando(null);
      setRevision((n) => n + 1);
    }
  }
  function acciones(item: ProductoAdmin, movil = false) {
    const nombre = `${item.itemcode}, lista ${item.pricelist}`;
    return (
      <div className="flex items-center gap-2">
        <BotonEditar
          etiqueta={`Editar ${nombre}`}
          onClick={() => abrir(item)}
          modo={movil ? "texto" : "icono"}
        />
        <BotonEliminarCampo
          etiqueta={`Eliminar ${nombre}`}
          modo={movil ? "texto" : "icono"}
          onClick={() => {
            op.limpiarError();
            setEliminando(item);
          }}
        />
      </div>
    );
  }
  const importe = (item: ProductoAdmin) =>
    item.price === null ? "Sin precio" : formatearPrecio(item.price);
  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground dark:text-foreground">
            Artículos y precios
          </h2>
          <p className="text-sm text-muted dark:text-muted">
            Una fila por artículo y lista. Los datos generales se comparten entre listas.
          </p>
        </div>
        <button
          type="button"
          className={`${btnPrimary} h-11 w-11 shrink-0 px-0`}
          aria-label="Crear producto"
          title="Crear producto"
          onClick={() => abrir()}
        >
          <IconoMas />
        </button>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className={labelBase}>
          Buscar artículo o lista
          <input
            className={inputBase}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            maxLength={200}
            placeholder="Código, nombre o lista"
          />
        </label>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPricelist(lista);
            setPage(1);
          }}
        >
          <label className={`${labelBase} min-w-0 flex-1 sm:w-32`}>
            pricelist
            <input
              className={inputBase}
              type="number"
              step="1"
              min={-2147483648}
              max={2147483647}
              value={lista}
              onChange={(e) => setLista(e.target.value)}
              placeholder="Todas"
            />
          </label>
          <button className={btnGhost} type="submit">
            Filtrar
          </button>
        </form>
      </div>
      {registros.error && (
        <div className={errorBox} role="alert">
          {registros.error}
          <button
            type="button"
            className={`${btnGhost} ml-3`}
            onClick={registros.refrescar}
          >
            Reintentar
          </button>
        </div>
      )}
      {registros.items.length === 0 &&
        !registros.cargando &&
        !registros.error && (
          <p className="py-8 text-center text-muted dark:text-muted">
            No hay artículos para estos filtros.
          </p>
        )}
      {registros.items.length > 0 && (
        <>
          <ul
            aria-label="Artículos y precios"
            className="divide-y divide-line md:hidden dark:divide-line"
          >
            {registros.items.map((item) => (
              <li key={item.id} className="min-w-0 space-y-3 py-4">
                <div className="break-words">
                  <p className="font-semibold text-foreground dark:text-foreground">
                    {item.itemname}
                  </p>
                  <p className="font-mono text-xs text-muted dark:text-muted">
                    {item.itemcode}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted dark:text-muted">
                      Lista {item.pricelist}
                    </dt>
                    <dd className="break-words">
                      {item.pricelistname ?? "Sin nombre"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted dark:text-muted">Precio</dt>
                    <dd className="break-words font-mono">{importe(item)}</dd>
                  </div>
                </dl>
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer rounded px-2 py-3 text-muted hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-muted dark:hover:bg-surface-soft">
                    Ver detalles de {item.itemcode}
                  </summary>
                  <dl className="grid grid-cols-2 gap-2 py-2">
                    <div>
                      <dt className="text-muted dark:text-muted">iva</dt>
                      <dd>{item.iva}</dd>
                    </div>
                    <div>
                      <dt className="text-muted dark:text-muted">inventory</dt>
                      <dd>{item.inventory ?? "Sin definir"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted dark:text-muted">
                        Grupo de artículos
                      </dt>
                      <dd className="break-words">
                        {item.itmsgrpcode ?? "Sin definir"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted dark:text-muted">tipo</dt>
                      <dd className="break-words">
                        {item.tipo ?? "Sin definir"}
                      </dd>
                    </div>
                  </dl>
                </details>
                {acciones(item, true)}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border-y border-line md:block dark:border-line">
            <table className="w-full text-sm" aria-label="Artículos y precios">
              <thead>
                <tr>
                  {[
                    "Artículo",
                    "Lista",
                    "Precio",
                    "iva",
                    "Grupo / inventory",
                    "Acciones",
                  ].map((s) => (
                    <th key={s} className={encabezado}>
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-line">
                {registros.items.map((item) => (
                  <tr key={item.id}>
                    <td className={celda}>
                      <p className="max-w-sm break-words font-semibold">
                        {item.itemname}
                      </p>
                      <p className="font-mono text-xs text-muted dark:text-muted">
                        {item.itemcode}
                      </p>
                    </td>
                    <td className={celda}>
                      <p>{item.pricelist}</p>
                      <p className="max-w-48 break-words text-xs text-muted dark:text-muted">
                        {item.pricelistname ?? "Sin nombre"}
                      </p>
                    </td>
                    <td
                      className={`${celda} whitespace-nowrap font-mono tabular-nums`}
                    >
                      {importe(item)}
                    </td>
                    <td className={celda}>{item.iva}</td>
                    <td className={celda}>
                      <p className="max-w-48 break-words">
                        {item.itmsgrpcode ?? "Sin definir"}
                      </p>
                      <p className="text-xs text-muted dark:text-muted">
                        {item.inventory ?? "Sin definir"} ·{" "}
                        {item.tipo ?? "Sin tipo"}
                      </p>
                    </td>
                    <td className={celda}>{acciones(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {registros.datos && (
        <Paginacion
          page={registros.page}
          limit={registros.limit}
          total={registros.datos.total}
          totalPages={registros.datos.totalPages}
          onPageChange={registros.setPage}
          onLimitChange={registros.setLimit}
        />
      )}
      <Modal
        abierto={form !== null}
        titulo={`${editando === null ? "Crear" : "Editar"} producto · ${empresa.nombre}`}
        onCerrar={() => {
          if (!op.mensaje) setForm(null);
        }}
      >
        {form && (
          <FormularioProducto
            form={form}
            onCambiar={setForm}
            error={op.error}
            ocupado={!!op.mensaje}
            onCancelar={() => setForm(null)}
            onGuardar={() => void guardar()}
          />
        )}
      </Modal>
      <Modal
        abierto={eliminando !== null}
        titulo="Eliminar artículo de la lista"
        onCerrar={() => {
          if (!op.mensaje) setEliminando(null);
        }}
      >
        {eliminando && (
          <div className="space-y-4">
            <p className="break-words">
              ¿Eliminar {eliminando.itemcode} · {eliminando.itemname} de la
              lista {eliminando.pricelist}?
            </p>
            <p className="text-sm text-muted dark:text-muted">
              Las otras listas de este artículo se conservan.
            </p>
            {op.error && (
              <p className={errorBox} role="alert">
                {op.error}
              </p>
            )}
            <div className={pieModal}>
              <button
                className={btnGhost}
                disabled={!!op.mensaje}
                onClick={() => setEliminando(null)}
              >
                Cancelar
              </button>
              <button
                className={btnDanger}
                disabled={!!op.mensaje}
                onClick={() => void eliminar()}
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>
      {(op.mensaje || registros.cargando) && (
        <PantallaCarga
          visible
          mensaje={op.mensaje || "Cargando artículos y precios"}
        />
      )}
    </div>
  );
}

function FormularioProducto({
  form,
  onCambiar,
  error,
  ocupado,
  onCancelar,
  onGuardar,
}: {
  form: FormProducto;
  onCambiar: (form: FormProducto) => void;
  error: string | null;
  ocupado: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar();
      }}
    >
      <fieldset
        disabled={ocupado}
        className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <label className={labelBase}>
          itemcode
          <input
            className={inputBase}
            value={form.itemcode}
            maxLength={15}
            required
            pattern=".*\S.*"
            onChange={(e) => onCambiar({ ...form, itemcode: e.target.value })}
          />
        </label>
        <label className={labelBase}>
          itemname
          <input
            className={inputBase}
            value={form.itemname}
            maxLength={200}
            pattern=".*\S.*"
            onChange={(e) => onCambiar({ ...form, itemname: e.target.value })}
          />
        </label>
        <label className={labelBase}>
          iva
          <input
            className={inputBase}
            type="number"
            min={-32768}
            max={32767}
            step="1"
            value={form.iva}
            onChange={(e) => onCambiar({ ...form, iva: e.target.value })}
          />
        </label>
        <label className={labelBase}>
          itmsgrpcode
          <input
            className={inputBase}
            type="number"
            min={-32768}
            max={32767}
            step="1"
            value={form.itmsgrpcode}
            onChange={(e) =>
              onCambiar({ ...form, itmsgrpcode: e.target.value })
            }
          />
        </label>
        <label className={labelBase}>
          inventory
          <input
            className={inputBase}
            value={form.inventory}
            maxLength={1}
            placeholder="Y / N"
            onChange={(e) => onCambiar({ ...form, inventory: e.target.value })}
          />
        </label>
        <label className={labelBase}>
          pricelist
          <input
            className={inputBase}
            type="number"
            min={-2147483648}
            max={2147483647}
            step="1"
            required
            value={form.pricelist}
            onChange={(e) => onCambiar({ ...form, pricelist: e.target.value })}
          />
        </label>
        <label className={labelBase}>
          pricelistname
          <input
            className={inputBase}
            value={form.pricelistname}
            maxLength={200}
            onChange={(e) =>
              onCambiar({ ...form, pricelistname: e.target.value })
            }
          />
        </label>
        <label className={labelBase}>
          price
          <input
            className={inputBase}
            type="text"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => {
              e.target.setCustomValidity("");
              onCambiar({ ...form, price: e.target.value });
            }}
            onBlur={(e) => {
              const value = datosProducto(form).price;
              e.target.setCustomValidity(
                value === null ||
                  /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/.test(value)
                  ? ""
                  : "Usá hasta 15 enteros y 6 decimales.",
              );
            }}
          />
          <span className="text-xs font-normal text-muted dark:text-muted">
            Vacío: sin precio. Hasta 6 decimales.
          </span>
        </label>
        <label className={labelBase}>
          tipo
          <input
            className={inputBase}
            value={form.tipo}
            maxLength={50}
            onChange={(e) => onCambiar({ ...form, tipo: e.target.value })}
          />
        </label>
      </fieldset>
      <p className="text-sm text-muted dark:text-muted">
        Nombre, impuesto, grupo, inventario y tipo pertenecen al artículo y se comparten entre sus listas.
        El nombre de la lista se comparte entre todos sus artículos.
      </p>
      {error && (
        <p className={errorBox} role="alert">
          {error}
        </p>
      )}
      <div className={pieModal}>
        <button
          type="button"
          className={btnGhost}
          disabled={ocupado}
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button type="submit" className={btnPrimary} disabled={ocupado}>
          Guardar
        </button>
      </div>
    </form>
  );
}
