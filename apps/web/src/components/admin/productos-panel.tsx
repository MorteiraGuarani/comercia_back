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
  btnGhost,
  btnPrimary,
  errorBox,
  inputBase,
  labelBase,
} from "@/components/ui";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { normalizarPrecio } from "@/utils/precio-producto";
import type {
  EmpresaCatalogo,
  FormPrecio,
  FormProducto,
  RegistroCatalogo,
} from "@/types/producto";

export function ProductosPanel() {
  const [empresa, setEmpresa] = useState<EmpresaCatalogo | null>(null);
  const [vista, setVista] = useState<"productos" | "precios">("productos");
  return (
    <section
      className="campo-screen min-w-0 w-full space-y-5"
      aria-label="Productos y precios"
    >
      <div className="max-w-md">
        <SelectorPaginado
          url="/admin/catalogo/empresas"
          etiqueta="Empresa del catálogo"
          value={empresa?.id ?? ""}
          seleccionActual={empresa?.nombre}
          buscable
          required
          onChange={(id) => {
            if (id === "") setEmpresa(null);
          }}
          onSeleccionar={(item) =>
            setEmpresa({ id: item.id, nombre: item.nombre ?? "" })
          }
        />
      </div>
      {empresa ? (
        <>
          <p className="text-sm text-muted dark:text-muted">
            Catálogo de{" "}
            <strong className="text-foreground dark:text-foreground">
              {empresa.nombre}
            </strong>
          </p>
          <div className="flex gap-2" role="group" aria-label="Elegir catálogo">
            {(["productos", "precios"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={vista === tab}
                onClick={() => setVista(tab)}
                className={`${vista === tab ? btnPrimary : btnGhost} cursor-pointer`}
              >
                {tab === "productos" ? "Productos" : "Precios"}
              </button>
            ))}
          </div>
          <RegistrosCatalogo
            key={`${empresa.id}:${vista}`}
            empresa={empresa}
            vista={vista}
          />
        </>
      ) : (
        <p className="py-4 text-sm text-muted dark:text-muted">
          Seleccioná una empresa para administrar sus productos y precios.
        </p>
      )}
    </section>
  );
}

function RegistrosCatalogo({
  empresa,
  vista,
}: {
  empresa: EmpresaCatalogo;
  vista: "productos" | "precios";
}) {
  const base = `/admin/catalogo/empresas/${empresa.id}`;
  const [busqueda, setBusqueda] = useState("");
  const [buscar, setBuscar] = useState("");
  const [productoFiltro, setProductoFiltro] = useState("");
  const [nombreFiltro, setNombreFiltro] = useState("");
  const parametros = new URLSearchParams({ buscar });
  if (productoFiltro) parametros.set("cardCode", productoFiltro);
  const lista = useListaCampo<RegistroCatalogo>(
    `${base}/${vista}?${parametros}`,
    0,
    7,
  );
  const { setPage } = lista;
  const op = useOperacionCampo();
  const [formProducto, setFormProducto] = useState<FormProducto | null>(null);
  const [codigoEditando, setCodigoEditando] = useState<string | null>(null);
  const [formPrecio, setFormPrecio] = useState<FormPrecio | null>(null);
  const [precioEditando, setPrecioEditando] = useState<number | null>(null);
  const [nombreProducto, setNombreProducto] = useState("");
  const [eliminando, setEliminando] = useState<RegistroCatalogo | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscar(busqueda.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, setPage]);

  function abrir(registro?: RegistroCatalogo) {
    op.limpiarError();
    if (vista === "productos" && (!registro || !("id" in registro))) {
      setCodigoEditando(registro?.cardCode ?? null);
      setFormProducto(
        registro
          ? {
              ...registro,
              iva: String(registro.iva),
              grupo: String(registro.grupo),
            }
          : {
              cardCode: "",
              descripcion: "",
              iva: "",
              grupo: "",
              nombreGrupo: "",
              inventario: false,
              tipo: "",
            },
      );
    } else if (!registro || "id" in registro) {
      setPrecioEditando(registro?.id ?? null);
      setNombreProducto(
        registro
          ? `${registro.cardCode} · ${registro.producto.descripcion}`
          : "",
      );
      setFormPrecio(
        registro
          ? { ...registro, nroListaPrecio: String(registro.nroListaPrecio) }
          : { cardCode: "", nroListaPrecio: "", listaPrecio: "", precio: "" },
      );
    }
  }

  async function guardarProducto() {
    if (!formProducto) return;
    const { cardCode, ...campos } = formProducto;
    const data = {
      descripcion: campos.descripcion,
      iva: Number(campos.iva),
      grupo: Number(campos.grupo),
      nombreGrupo: campos.nombreGrupo,
      inventario: campos.inventario,
      tipo: campos.tipo,
    };
    const ok = await op.ejecutar("Guardando producto", () =>
      apiFetch(
        `${base}/productos${codigoEditando !== null ? `/${encodeURIComponent(codigoEditando)}` : ""}`,
        {
          method: codigoEditando !== null ? "PUT" : "POST",
          body: JSON.stringify(
            codigoEditando !== null ? data : { ...data, cardCode },
          ),
        },
      ),
    );
    if (ok) {
      setFormProducto(null);
      lista.refrescar();
    }
  }

  async function guardarPrecio() {
    if (!formPrecio) return;
    const ok = await op.ejecutar("Guardando precio", () =>
      apiFetch(
        `${base}/precios${precioEditando !== null ? `/${precioEditando}` : ""}`,
        {
          method: precioEditando !== null ? "PUT" : "POST",
          body: JSON.stringify({
            cardCode: formPrecio.cardCode,
            nroListaPrecio: Number(formPrecio.nroListaPrecio),
            listaPrecio: formPrecio.listaPrecio,
            precio: normalizarPrecio(formPrecio.precio),
          }),
        },
      ),
    );
    if (ok) {
      setFormPrecio(null);
      lista.refrescar();
    }
  }

  async function eliminar() {
    if (!eliminando) return;
    const ruta =
      "id" in eliminando
        ? `precios/${eliminando.id}`
        : `productos/${encodeURIComponent(eliminando.cardCode)}`;
    const ok = await op.ejecutar("Eliminando registro del catálogo", () =>
      apiFetch(`${base}/${ruta}`, { method: "DELETE" }),
    );
    if (ok) {
      setEliminando(null);
      lista.refrescar();
    }
  }

  const acciones = (item: RegistroCatalogo, movil: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <BotonEditar
        onClick={() => abrir(item)}
        etiqueta={`Editar ${"id" in item ? `precio ${item.id}` : `producto ${item.cardCode}`} de ${empresa.nombre}`}
        modo={movil ? "texto" : "icono"}
      />
      <BotonEliminarCampo
        onClick={() => {
          op.limpiarError();
          setEliminando(item);
        }}
        etiqueta={`Eliminar ${"id" in item ? `precio ${item.id}` : `producto ${item.cardCode}`} de ${empresa.nombre}`}
        modo={movil ? "texto" : "icono"}
        disabled={!!op.mensaje}
      />
    </div>
  );

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className={`${labelBase} min-w-0 flex-1`}>
          Buscar {vista}
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={inputBase}
            placeholder="CardCode, descripción o lista"
            maxLength={200}
          />
        </label>
        <button
          type="button"
          onClick={() => abrir()}
          className={`${btnPrimary} h-11 w-11 shrink-0 p-0`}
          aria-label={`Crear ${vista === "productos" ? "producto" : "precio"}`}
          title={`Crear ${vista === "productos" ? "producto" : "precio"}`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>
      {vista === "precios" && (
        <div className="max-w-md">
          <SelectorPaginado<string>
            url={`${base}/productos/opciones`}
            etiqueta="Producto"
            value={productoFiltro}
            seleccionActual={nombreFiltro}
            buscable
            vacio="Todos los productos"
            onChange={(id) => {
              setProductoFiltro(id);
              setPage(1);
            }}
            onSeleccionar={(item) => setNombreFiltro(item.nombre ?? "")}
          />
        </div>
      )}
      {lista.error && (
        <p role="alert" className={errorBox}>
          {lista.error}
          <button
            type="button"
            className={`${btnGhost} ml-2`}
            onClick={lista.refrescar}
          >
            Reintentar
          </button>
        </p>
      )}
      {!lista.cargando && !lista.items.length && (
        <p className="py-6 text-sm text-muted dark:text-muted">
          {buscar || productoFiltro
            ? "No hay registros con estos filtros."
            : `Esta empresa todavía no tiene ${vista}.`}
        </p>
      )}
      <ul
        className="divide-y divide-line md:hidden dark:divide-line"
        aria-label={vista === "productos" ? "Productos" : "Precios"}
      >
        {lista.items.map((item) => (
          <li
            key={"id" in item ? item.id : item.cardCode}
            className="min-w-0 space-y-2 py-4"
          >
            <p className="break-words font-semibold text-foreground dark:text-foreground">
              {"id" in item ? item.producto.descripcion : item.descripcion}
            </p>
            <p className="break-words font-mono text-xs text-muted dark:text-muted">
              {item.cardCode}
            </p>
            {"id" in item ? (
              <>
                <p className="break-words text-sm text-foreground dark:text-foreground">
                  Lista {item.nroListaPrecio}: {item.listaPrecio}
                </p>
                <p className="font-mono text-sm text-foreground dark:text-foreground">
                  {item.precio}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted dark:text-muted">
                  IVA {item.iva}% · Grupo {item.grupo} · Inventario{" "}
                  {item.inventario ? "Sí" : "No"}
                </p>
                <p className="break-words text-xs text-muted dark:text-muted">
                  {item.nombreGrupo} · {item.tipo}
                </p>
              </>
            )}
            {acciones(item, true)}
          </li>
        ))}
      </ul>
      <div className="hidden max-w-full overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            {vista} de {empresa.nombre}
          </caption>
          <thead className="border-b border-line text-xs text-muted dark:border-line dark:text-muted">
            <tr>
              <th className="p-3">CardCode</th>
              <th className="p-3">Descripción</th>
              {vista === "productos" ? (
                <>
                  <th className="p-3">IVA</th>
                  <th className="p-3">Grupo</th>
                  <th className="p-3">Nombre del grupo</th>
                  <th className="p-3">Inventario</th>
                  <th className="p-3">Tipo</th>
                </>
              ) : (
                <>
                  <th className="p-3">N.º lista</th>
                  <th className="p-3">Lista de precio</th>
                  <th className="p-3 text-right">Precio</th>
                </>
              )}
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line dark:divide-line">
            {lista.items.map((item) => (
              <tr
                key={"id" in item ? item.id : item.cardCode}
                className="hover:bg-surface-soft dark:hover:bg-surface-soft"
              >
                <td className="p-3 font-mono">{item.cardCode}</td>
                <td className="min-w-40 break-words p-3">
                  {"id" in item ? item.producto.descripcion : item.descripcion}
                </td>
                {"id" in item ? (
                  <>
                    <td className="p-3">{item.nroListaPrecio}</td>
                    <td className="break-words p-3">{item.listaPrecio}</td>
                    <td className="whitespace-nowrap p-3 text-right font-mono">
                      {item.precio}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3">{item.iva}%</td>
                    <td className="p-3">{item.grupo}</td>
                    <td className="break-words p-3">{item.nombreGrupo}</td>
                    <td className="p-3">{item.inventario ? "Sí" : "No"}</td>
                    <td className="break-words p-3">{item.tipo}</td>
                  </>
                )}
                <td className="p-3">{acciones(item, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion
        page={lista.page}
        limit={lista.limit}
        total={lista.datos?.total ?? 0}
        totalPages={lista.datos?.totalPages ?? 1}
        onPageChange={lista.setPage}
        onLimitChange={lista.setLimit}
      />
      <Modal
        titulo={`${codigoEditando !== null ? "Editar" : "Crear"} producto · ${empresa.nombre}`}
        abierto={!!formProducto}
        onCerrar={() => {
          if (!op.mensaje) setFormProducto(null);
        }}
        ancho="lg"
      >
        {formProducto && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guardarProducto();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ["cardCode", "CardCode", 50],
                  ["descripcion", "Descripción", 200],
                  ["nombreGrupo", "Nombre del grupo", 200],
                  ["tipo", "Tipo", 100],
                ] as const
              ).map(([campo, etiqueta, max]) => (
                <label key={campo} className={labelBase}>
                  {etiqueta}
                  <input
                    className={inputBase}
                    value={formProducto[campo]}
                    maxLength={max}
                    required={campo === "cardCode" || campo === "descripcion"}
                    disabled={campo === "cardCode" && codigoEditando !== null}
                    onChange={(e) =>
                      setFormProducto({
                        ...formProducto,
                        [campo]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label className={labelBase}>
                IVA (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  className={inputBase}
                  value={formProducto.iva}
                  onChange={(e) =>
                    setFormProducto({ ...formProducto, iva: e.target.value })
                  }
                />
              </label>
              <label className={labelBase}>
                Grupo
                <input
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  required
                  className={inputBase}
                  value={formProducto.grupo}
                  onChange={(e) =>
                    setFormProducto({ ...formProducto, grupo: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface-soft dark:hover:bg-surface-soft">
              <input
                type="checkbox"
                checked={formProducto.inventario}
                onChange={(e) =>
                  setFormProducto({
                    ...formProducto,
                    inventario: e.target.checked,
                  })
                }
              />
              Maneja inventario
            </label>
            {op.error && (
              <p role="alert" className={errorBox}>
                {op.error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnGhost}
                disabled={!!op.mensaje}
                onClick={() => setFormProducto(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={!!op.mensaje}
              >
                Guardar producto
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        titulo={`${precioEditando !== null ? "Editar" : "Crear"} precio · ${empresa.nombre}`}
        abierto={!!formPrecio}
        onCerrar={() => {
          if (!op.mensaje) setFormPrecio(null);
        }}
      >
        {formPrecio && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guardarPrecio();
            }}
          >
            <SelectorPaginado<string>
              key={`precio:${precioEditando}`}
              url={`${base}/productos/opciones`}
              etiqueta="Producto"
              value={formPrecio.cardCode}
              seleccionActual={nombreProducto}
              required
              buscable
              onChange={(cardCode) =>
                setFormPrecio({ ...formPrecio, cardCode })
              }
              onSeleccionar={(p) => setNombreProducto(p.nombre ?? "")}
            />
            <label className={labelBase}>
              Número de lista
              <input
                type="number"
                min={0}
                max={2147483647}
                step={1}
                required
                className={inputBase}
                value={formPrecio.nroListaPrecio}
                onChange={(e) =>
                  setFormPrecio({
                    ...formPrecio,
                    nroListaPrecio: e.target.value,
                  })
                }
              />
            </label>
            <label className={labelBase}>
              Lista de precio
              <input
                className={inputBase}
                maxLength={200}
                required
                value={formPrecio.listaPrecio}
                onChange={(e) =>
                  setFormPrecio({ ...formPrecio, listaPrecio: e.target.value })
                }
              />
            </label>
            <label className={labelBase}>
              Precio
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.000000"
                required
                maxLength={22}
                className={inputBase}
                value={formPrecio.precio}
                onChange={(e) =>
                  setFormPrecio({ ...formPrecio, precio: e.target.value })
                }
              />
            </label>
            <p className="text-xs text-muted dark:text-muted">
              Admite hasta 15 dígitos enteros y 6 decimales.
            </p>
            {op.error && (
              <p role="alert" className={errorBox}>
                {op.error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnGhost}
                disabled={!!op.mensaje}
                onClick={() => setFormPrecio(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={!!op.mensaje}
              >
                Guardar precio
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        titulo={`Eliminar ${eliminando && "id" in eliminando ? "precio" : "producto"}`}
        abierto={!!eliminando}
        onCerrar={() => {
          if (!op.mensaje) setEliminando(null);
        }}
      >
        {eliminando && (
          <div className="space-y-4">
            <p className="break-words text-sm">
              ¿Eliminar{" "}
              {"id" in eliminando
                ? `el precio de la lista ${eliminando.nroListaPrecio}`
                : `el producto ${eliminando.cardCode}`}{" "}
              de {empresa.nombre}?
            </p>
            {!("id" in eliminando) && eliminando._count.precios > 0 && (
              <p className="text-sm text-muted dark:text-muted">
                También se eliminarán sus {eliminando._count.precios} precios.
              </p>
            )}
            {op.error && (
              <p role="alert" className={errorBox}>
                {op.error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnGhost}
                disabled={!!op.mensaje}
                onClick={() => setEliminando(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!!op.mensaje}
                onClick={() => void eliminar()}
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>
      <PantallaCarga
        visible={lista.cargando || !!op.mensaje}
        mensaje={op.mensaje || `Cargando ${vista} de ${empresa.nombre}`}
      />
    </div>
  );
}
