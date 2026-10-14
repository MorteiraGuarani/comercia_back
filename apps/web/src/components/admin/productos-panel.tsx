"use client";

import { useEffect, useId, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SelectorPaginado } from "@/components/selector-paginado";
import { BotonEditar } from "@/components/boton-editar";
import { BotonEliminarCampo } from "@/components/campo/boton-eliminar-campo";
import {
  IconoBuscar,
  IconoChevronAbajo,
} from "@/components/campo/ui/iconos-campo";
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
  normalizarPrecio,
  recortarPrecio,
} from "@/utils/precio-producto";
import type {
  EmpresaCatalogo,
  FiltroProductoCatalogo,
  FormPrecio,
  FormProducto,
  PrecioAdmin,
  ProductoAdmin,
  RegistroCatalogo,
  VistaCatalogo,
} from "@/types/producto";

const chip =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";
const chipNeutro = `${chip} bg-surface-soft text-muted dark:bg-surface-soft dark:text-muted`;
const chipActivo = `${chip} bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200`;
const btnEnlace =
  "inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-brand-700 underline-offset-2 transition-colors hover:bg-brand-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-brand-200 dark:hover:bg-brand-950";
const celda = "px-4 py-3 align-middle";
const encabezado =
  "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted";
const pieModal =
  "flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end dark:border-line";
const PRODUCTO_VACIO: FormProducto = {
  cardCode: "",
  descripcion: "",
  iva: "",
  grupo: "",
  nombreGrupo: "",
  inventario: false,
  tipo: "",
};

export function ProductosPanel() {
  const [empresa, setEmpresa] = useState<EmpresaCatalogo | null>(null);
  const [vista, setVista] = useState<VistaCatalogo>("productos");
  // «Ver precios» desde un producto abre Precios ya filtrado por ese producto.
  const [filtroInicial, setFiltroInicial] =
    useState<FiltroProductoCatalogo | null>(null);

  function cambiarVista(
    nueva: VistaCatalogo,
    filtro: FiltroProductoCatalogo | null = null,
  ) {
    setFiltroInicial(filtro);
    setVista(nueva);
  }

  return (
    <section
      className="campo-screen min-w-0 w-full space-y-4"
      aria-label="Productos y precios"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 sm:w-80 lg:w-96">
          <SelectorPaginado
            url="/admin/catalogo/empresas"
            etiqueta="Empresa"
            value={empresa?.id ?? ""}
            seleccionActual={empresa?.nombre}
            placeholder="Elegí una empresa"
            buscable
            required
            // Escribir solo busca: el catálogo visible cambia recién al
            // elegir otra empresa, y al salir sin elegir vuelve la actual.
            onChange={() => {}}
            onSeleccionar={(item) => {
              setFiltroInicial(null);
              setEmpresa({ id: item.id, nombre: item.nombre ?? "" });
            }}
          />
        </div>
        {empresa && (
          <SelectorVista vista={vista} onCambiar={(v) => cambiarVista(v)} />
        )}
      </div>
      {empresa ? (
        <RegistrosCatalogo
          key={`${empresa.id}:${vista}:${filtroInicial?.cardCode ?? ""}`}
          empresa={empresa}
          vista={vista}
          filtroInicial={filtroInicial}
          onVerPrecios={(filtro) => cambiarVista("precios", filtro)}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-4 py-12 text-center dark:border-line dark:bg-surface-raised">
          <p className="font-semibold text-foreground dark:text-foreground">
            Elegí una empresa para empezar
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted dark:text-muted">
            Vas a ver su catálogo de productos y sus listas de precios para
            crearlos, editarlos o eliminarlos.
          </p>
        </div>
      )}
    </section>
  );
}

function SelectorVista({
  vista,
  onCambiar,
}: {
  vista: VistaCatalogo;
  onCambiar: (vista: VistaCatalogo) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Elegir catálogo"
      className="grid min-w-0 grid-cols-2 overflow-hidden rounded-xl border border-control-line bg-surface-raised sm:inline-grid dark:border-control-line dark:bg-surface-raised"
    >
      {(["productos", "precios"] as const).map((opcion) => (
        <button
          key={opcion}
          type="button"
          aria-pressed={vista === opcion}
          onClick={() => onCambiar(opcion)}
          className={`min-h-11 cursor-pointer whitespace-nowrap px-6 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${
            opcion === "precios"
              ? "border-l border-control-line dark:border-control-line"
              : ""
          } ${
            vista === opcion
              ? "bg-brand-700 text-white dark:bg-brand-600 dark:text-white"
              : "text-muted hover:bg-surface-soft hover:text-foreground dark:text-muted dark:hover:bg-surface-soft dark:hover:text-foreground"
          }`}
        >
          {opcion === "productos" ? "Productos" : "Precios"}
        </button>
      ))}
    </div>
  );
}

function ListaPrecio({ nro, nombre }: { nro: number; nombre: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-surface-soft px-1.5 font-mono text-xs font-semibold text-foreground dark:bg-surface-soft dark:text-foreground">
        <span className="sr-only">Lista N.º </span>
        {nro}
      </span>
      <span className="min-w-0 break-words text-sm text-foreground dark:text-foreground">
        {nombre}
      </span>
    </span>
  );
}

function RegistrosCatalogo({
  empresa,
  vista,
  filtroInicial,
  onVerPrecios,
}: {
  empresa: EmpresaCatalogo;
  vista: VistaCatalogo;
  filtroInicial: FiltroProductoCatalogo | null;
  onVerPrecios: (filtro: FiltroProductoCatalogo) => void;
}) {
  const base = `/admin/catalogo/empresas/${empresa.id}`;
  const entidad = vista === "productos" ? "producto" : "precio";
  const [busqueda, setBusqueda] = useState("");
  const [buscar, setBuscar] = useState("");
  const [productoFiltro, setProductoFiltro] = useState(
    filtroInicial?.cardCode ?? "",
  );
  const [nombreFiltro, setNombreFiltro] = useState(filtroInicial?.nombre ?? "");
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
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  const idDetalle = useId();

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscar(busqueda.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, setPage]);

  function limpiarFiltros() {
    setBusqueda("");
    setBuscar("");
    setProductoFiltro("");
    setNombreFiltro("");
    setPage(1);
  }

  function abrirProducto(producto?: ProductoAdmin) {
    op.limpiarError();
    setCodigoEditando(producto?.cardCode ?? null);
    setFormProducto(
      producto
        ? {
            ...producto,
            iva: String(producto.iva),
            grupo: String(producto.grupo),
          }
        : PRODUCTO_VACIO,
    );
  }

  function abrirPrecio(precio?: PrecioAdmin) {
    op.limpiarError();
    setPrecioEditando(precio?.id ?? null);
    // Un precio nuevo arranca con el producto del filtro, si hay uno.
    setNombreProducto(
      precio
        ? `${precio.cardCode} · ${precio.producto.descripcion}`
        : nombreFiltro,
    );
    setFormPrecio(
      precio
        ? {
            cardCode: precio.cardCode,
            nroListaPrecio: String(precio.nroListaPrecio),
            listaPrecio: precio.listaPrecio,
            precio: recortarPrecio(precio.precio),
          }
        : {
            cardCode: productoFiltro,
            nroListaPrecio: "",
            listaPrecio: "",
            precio: "",
          },
    );
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

  const etiquetaDe = (item: RegistroCatalogo) =>
    `${"id" in item ? `precio ${item.id}` : `producto ${item.cardCode}`} de ${empresa.nombre}`;

  const acciones = (item: RegistroCatalogo, movil: boolean) => (
    <>
      <BotonEditar
        onClick={() =>
          "id" in item ? abrirPrecio(item) : abrirProducto(item)
        }
        etiqueta={`Editar ${etiquetaDe(item)}`}
        modo={movil ? "texto" : "icono"}
      />
      <BotonEliminarCampo
        onClick={() => {
          op.limpiarError();
          setEliminando(item);
        }}
        etiqueta={`Eliminar ${etiquetaDe(item)}`}
        modo={movil ? "texto" : "icono"}
        disabled={!!op.mensaje}
      />
    </>
  );

  const verPrecios = (producto: ProductoAdmin) => (
    <button
      type="button"
      className={btnEnlace}
      aria-label={`Ver precios del producto ${producto.cardCode}`}
      onClick={() =>
        onVerPrecios({
          cardCode: producto.cardCode,
          nombre: `${producto.cardCode} · ${producto.descripcion}`,
        })
      }
    >
      {producto._count.precios}{" "}
      {producto._count.precios === 1 ? "precio" : "precios"}
    </button>
  );

  const identidad = (descripcion: string, cardCode: string) => (
    <div className="min-w-0">
      <p className="break-words font-semibold text-foreground dark:text-foreground">
        {descripcion}
      </p>
      <p className="mt-0.5 break-words font-mono text-xs text-muted dark:text-muted">
        {cardCode}
      </p>
    </div>
  );

  const vacio = buscar
    ? {
        titulo: `No hay ${vista} que coincidan con «${buscar}»`,
        detalle: "Probá con otra búsqueda o quitá los filtros.",
      }
    : productoFiltro
      ? {
          titulo: "Este producto todavía no tiene precios",
          detalle: "Usá el botón + para cargarle el primero.",
        }
      : {
          titulo: `Esta empresa todavía no tiene ${vista}`,
          detalle: `Usá el botón + para cargar el primer ${entidad}.`,
        };
  const total = lista.datos?.total ?? 0;

  return (
    <div
      data-inicio-listado
      className="min-w-0 w-full scroll-mt-20 rounded-2xl border border-line bg-surface-raised shadow-sm dark:border-line dark:bg-surface-raised"
    >
      <div className="flex flex-wrap items-end gap-2 border-b border-line p-3 sm:p-4 md:flex-nowrap md:gap-3 dark:border-line">
        <label
          className={`${labelBase} order-1 min-w-0 grow basis-[calc(100%-3.5rem)] md:basis-0`}
        >
          Buscar
          <span className="relative block">
            <IconoBuscar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted dark:text-muted" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={`${inputBase} pl-10`}
              placeholder={
                vista === "productos"
                  ? "CardCode o descripción"
                  : "CardCode, descripción o lista"
              }
              maxLength={200}
            />
          </span>
        </label>
        {vista === "precios" && (
          <div className="order-3 w-full md:order-2 md:w-72 lg:w-80">
            <SelectorPaginado<string>
              url={`${base}/productos/opciones`}
              etiqueta="Producto"
              value={productoFiltro}
              seleccionActual={nombreFiltro}
              placeholder="Todos los productos"
              buscable
              onChange={(id) => {
                setProductoFiltro(id);
                setPage(1);
              }}
              onSeleccionar={(item) => setNombreFiltro(item.nombre ?? "")}
            />
          </div>
        )}
        {(busqueda || productoFiltro) && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className={`${btnEnlace} order-4 md:order-3`}
          >
            Limpiar filtros
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            vista === "productos" ? abrirProducto() : abrirPrecio()
          }
          className={`${btnPrimary} order-2 h-11 w-11 shrink-0 p-0 md:order-4`}
          aria-label={`Crear ${entidad}`}
          title={`Crear ${entidad}`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>
      {lista.error && (
        <div
          role="alert"
          className={`${errorBox} m-3 flex flex-wrap items-center justify-between gap-2 sm:m-4`}
        >
          <span className="min-w-0">{lista.error}</span>
          <button
            type="button"
            className={btnGhost}
            onClick={lista.refrescar}
          >
            Reintentar
          </button>
        </div>
      )}
      {!lista.cargando && !lista.error && !lista.items.length && (
        <div className="px-4 py-12 text-center">
          <p className="break-words font-semibold text-foreground dark:text-foreground">
            {vacio.titulo}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted dark:text-muted">
            {vacio.detalle}
          </p>
          {(buscar || productoFiltro) && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className={`${btnGhost} mt-4`}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
      {lista.items.length > 0 && (
        <>
          <ul
            className="divide-y divide-line md:hidden dark:divide-line"
            aria-label={vista === "productos" ? "Productos" : "Precios"}
          >
            {lista.items.map((item, indice) => {
              if ("id" in item)
                return (
                  <li
                    key={item.id}
                    className="min-w-0 space-y-3 px-4 py-4 [content-visibility:auto]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {identidad(item.producto.descripcion, item.cardCode)}
                      <p className="shrink-0 whitespace-nowrap text-base font-bold text-foreground [font-variant-numeric:tabular-nums] dark:text-foreground">
                        {formatearPrecio(item.precio)}
                      </p>
                    </div>
                    <ListaPrecio
                      nro={item.nroListaPrecio}
                      nombre={item.listaPrecio}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {acciones(item, true)}
                    </div>
                  </li>
                );
              const abierto = detalleAbierto === item.cardCode;
              const idPanel = `${idDetalle}-${indice}`;
              return (
                <li
                  key={item.cardCode}
                  className="min-w-0 space-y-3 px-4 py-4 [content-visibility:auto]"
                >
                  {identidad(item.descripcion, item.cardCode)}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={chipNeutro}>IVA {item.iva}%</span>
                    <span className={item.inventario ? chipActivo : chipNeutro}>
                      {item.inventario ? "Con inventario" : "Sin inventario"}
                    </span>
                    {verPrecios(item)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {acciones(item, true)}
                    <button
                      type="button"
                      aria-expanded={abierto}
                      aria-controls={idPanel}
                      onClick={() =>
                        setDetalleAbierto(abierto ? null : item.cardCode)
                      }
                      className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-muted dark:hover:bg-surface-soft dark:hover:text-foreground"
                    >
                      Detalles
                      <IconoChevronAbajo
                        className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                  {abierto && (
                    <dl
                      id={idPanel}
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-surface-soft p-3 text-sm dark:bg-surface-soft"
                    >
                      <dt className="text-muted dark:text-muted">Grupo</dt>
                      <dd className="break-words text-foreground dark:text-foreground">
                        {item.grupo}
                        {item.nombreGrupo ? ` · ${item.nombreGrupo}` : ""}
                      </dd>
                      <dt className="text-muted dark:text-muted">Tipo</dt>
                      <dd className="break-words text-foreground dark:text-foreground">
                        {item.tipo || "—"}
                      </dd>
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden max-w-full overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">
                {vista} de {empresa.nombre}
              </caption>
              <thead className="border-b border-line bg-surface-soft dark:border-line dark:bg-surface-soft">
                <tr>
                  <th className={encabezado}>Producto</th>
                  {vista === "productos" ? (
                    <>
                      <th className={encabezado}>Grupo</th>
                      <th className={encabezado}>Tipo</th>
                      <th className={`${encabezado} text-right`}>IVA</th>
                      <th className={encabezado}>Inventario</th>
                      <th className={encabezado}>Precios</th>
                    </>
                  ) : (
                    <>
                      <th className={encabezado}>Lista de precio</th>
                      <th className={`${encabezado} text-right`}>Precio</th>
                    </>
                  )}
                  <th className={encabezado}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-line">
                {lista.items.map((item) => (
                  <tr
                    key={"id" in item ? item.id : item.cardCode}
                    className="transition-colors hover:bg-surface-soft dark:hover:bg-surface-soft"
                  >
                    <td className={`${celda} min-w-48`}>
                      {"id" in item
                        ? identidad(item.producto.descripcion, item.cardCode)
                        : identidad(item.descripcion, item.cardCode)}
                    </td>
                    {"id" in item ? (
                      <>
                        <td className={celda}>
                          <ListaPrecio
                            nro={item.nroListaPrecio}
                            nombre={item.listaPrecio}
                          />
                        </td>
                        <td
                          className={`${celda} whitespace-nowrap text-right font-semibold text-foreground [font-variant-numeric:tabular-nums] dark:text-foreground`}
                        >
                          {formatearPrecio(item.precio)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={celda}>
                          <p className="break-words text-foreground dark:text-foreground">
                            {item.nombreGrupo || "—"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted dark:text-muted">
                            Grupo {item.grupo}
                          </p>
                        </td>
                        <td
                          className={`${celda} break-words text-foreground dark:text-foreground`}
                        >
                          {item.tipo || "—"}
                        </td>
                        <td
                          className={`${celda} text-right [font-variant-numeric:tabular-nums]`}
                        >
                          {item.iva}%
                        </td>
                        <td className={celda}>
                          <span
                            className={
                              item.inventario ? chipActivo : chipNeutro
                            }
                          >
                            {item.inventario ? "Sí" : "No"}
                          </span>
                        </td>
                        <td className={celda}>{verPrecios(item)}</td>
                      </>
                    )}
                    <td className={celda}>
                      <div className="flex items-center justify-end gap-1">
                        {acciones(item, false)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {total > 0 && (
        <div className="border-t border-line px-3 pb-3 sm:px-4 dark:border-line">
          <Paginacion
            page={lista.page}
            limit={lista.limit}
            total={total}
            totalPages={lista.datos?.totalPages ?? 1}
            onPageChange={lista.setPage}
            onLimitChange={lista.setLimit}
          />
        </div>
      )}
      <Modal
        titulo={`${codigoEditando !== null ? "Editar" : "Crear"} producto · ${empresa.nombre}`}
        abierto={!!formProducto}
        onCerrar={() => {
          if (!op.mensaje) setFormProducto(null);
        }}
        ancho="lg"
      >
        {formProducto && (
          <FormularioProducto
            form={formProducto}
            onCambiar={setFormProducto}
            editando={codigoEditando !== null}
            error={op.error}
            procesando={!!op.mensaje}
            onCancelar={() => setFormProducto(null)}
            onGuardar={() => void guardarProducto()}
          />
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
          <FormularioPrecio
            key={`precio:${precioEditando}`}
            urlProductos={`${base}/productos/opciones`}
            form={formPrecio}
            onCambiar={setFormPrecio}
            nombreProducto={nombreProducto}
            onNombreProducto={setNombreProducto}
            editando={precioEditando !== null}
            error={op.error}
            procesando={!!op.mensaje}
            onCancelar={() => setFormPrecio(null)}
            onGuardar={() => void guardarPrecio()}
          />
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
            <p className="break-words text-sm text-foreground dark:text-foreground">
              {"id" in eliminando ? (
                <>
                  ¿Eliminar el precio de{" "}
                  <strong>
                    {eliminando.cardCode} · {eliminando.producto.descripcion}
                  </strong>{" "}
                  en la lista{" "}
                  <strong>
                    {eliminando.nroListaPrecio} · {eliminando.listaPrecio}
                  </strong>{" "}
                  ({formatearPrecio(eliminando.precio)})?
                </>
              ) : (
                <>
                  ¿Eliminar el producto{" "}
                  <strong>
                    {eliminando.cardCode} · {eliminando.descripcion}
                  </strong>{" "}
                  de {empresa.nombre}?
                </>
              )}
            </p>
            {!("id" in eliminando) && eliminando._count.precios > 0 && (
              <p className={errorBox}>
                También se{" "}
                {eliminando._count.precios === 1
                  ? "eliminará su precio"
                  : `eliminarán sus ${eliminando._count.precios} precios`}
                .
              </p>
            )}
            <p className="text-sm text-muted dark:text-muted">
              Esta acción no se puede deshacer.
            </p>
            {op.error && (
              <p role="alert" className={errorBox}>
                {op.error}
              </p>
            )}
            <div className={pieModal}>
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
                className={btnDanger}
                disabled={!!op.mensaje}
                onClick={() => void eliminar()}
              >
                Eliminar {"id" in eliminando ? "precio" : "producto"}
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

function FormularioProducto({
  form,
  onCambiar,
  editando,
  error,
  procesando,
  onCancelar,
  onGuardar,
}: {
  form: FormProducto;
  onCambiar: (form: FormProducto) => void;
  editando: boolean;
  error: string | null;
  procesando: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  const texto = (
    campo: "cardCode" | "descripcion" | "nombreGrupo" | "tipo",
    etiqueta: string,
    max: number,
    clase = "",
  ) => (
    <label className={`${labelBase} ${clase}`}>
      {etiqueta}
      <input
        className={`${inputBase} disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted dark:disabled:bg-surface-soft dark:disabled:text-muted`}
        value={form[campo]}
        maxLength={max}
        required={campo === "cardCode" || campo === "descripcion"}
        disabled={campo === "cardCode" && editando}
        title={
          campo === "cardCode" && editando
            ? "El CardCode no se puede modificar"
            : undefined
        }
        onChange={(e) => onCambiar({ ...form, [campo]: e.target.value })}
      />
    </label>
  );
  const numero = (campo: "iva" | "grupo", etiqueta: string, max: number) => (
    <label className={labelBase}>
      {etiqueta}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        required
        className={inputBase}
        value={form[campo]}
        onChange={(e) => onCambiar({ ...form, [campo]: e.target.value })}
      />
    </label>
  );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {texto("cardCode", "CardCode", 50)}
        {texto("tipo", "Tipo", 100)}
        {texto("descripcion", "Descripción", 200, "sm:col-span-2")}
        {numero("grupo", "Grupo", 2147483647)}
        {texto("nombreGrupo", "Nombre del grupo", 200)}
        {numero("iva", "IVA (%)", 100)}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-control-line px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft dark:border-control-line dark:text-foreground dark:hover:bg-surface-soft">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-brand-700"
            checked={form.inventario}
            onChange={(e) => onCambiar({ ...form, inventario: e.target.checked })}
          />
          Maneja inventario
        </label>
      </div>
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <div className={pieModal}>
        <button
          type="button"
          className={btnGhost}
          disabled={procesando}
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button type="submit" className={btnPrimary} disabled={procesando}>
          {editando ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}

function FormularioPrecio({
  urlProductos,
  form,
  onCambiar,
  nombreProducto,
  onNombreProducto,
  editando,
  error,
  procesando,
  onCancelar,
  onGuardar,
}: {
  urlProductos: string;
  form: FormPrecio;
  onCambiar: (form: FormPrecio) => void;
  nombreProducto: string;
  onNombreProducto: (nombre: string) => void;
  editando: boolean;
  error: string | null;
  procesando: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  const idAyuda = useId();
  const normalizado = normalizarPrecio(form.precio);
  // Vista previa del valor: evita que «12.500» se guarde como 12,5 sin aviso.
  const valido = /^\d{1,15}(\.\d{1,6})?$/.test(normalizado);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar();
      }}
    >
      <SelectorPaginado<string>
        url={urlProductos}
        etiqueta="Producto"
        value={form.cardCode}
        seleccionActual={nombreProducto}
        required
        buscable
        onChange={(cardCode) => onCambiar({ ...form, cardCode })}
        onSeleccionar={(p) => onNombreProducto(p.nombre ?? "")}
      />
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
        <label className={labelBase}>
          N.º lista
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={2147483647}
            step={1}
            required
            className={inputBase}
            value={form.nroListaPrecio}
            onChange={(e) =>
              onCambiar({ ...form, nroListaPrecio: e.target.value })
            }
          />
        </label>
        <label className={labelBase}>
          Lista de precio
          <input
            className={inputBase}
            maxLength={200}
            required
            placeholder="Ej.: Mayorista"
            value={form.listaPrecio}
            onChange={(e) => onCambiar({ ...form, listaPrecio: e.target.value })}
          />
        </label>
      </div>
      <label className={labelBase}>
        Precio
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          required
          maxLength={22}
          aria-describedby={idAyuda}
          className={`${inputBase} text-right font-semibold [font-variant-numeric:tabular-nums]`}
          value={form.precio}
          onChange={(e) => onCambiar({ ...form, precio: e.target.value })}
        />
        <span
          id={idAyuda}
          className="text-xs font-normal text-muted dark:text-muted"
        >
          {valido ? (
            <>
              Se guardará como{" "}
              <strong className="font-semibold text-foreground dark:text-foreground">
                {formatearPrecio(normalizado)}
              </strong>
            </>
          ) : (
            "Sin separador de miles. Hasta 15 enteros y 6 decimales, con coma o punto."
          )}
        </span>
      </label>
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <div className={pieModal}>
        <button
          type="button"
          className={btnGhost}
          disabled={procesando}
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button type="submit" className={btnPrimary} disabled={procesando}>
          {editando ? "Guardar cambios" : "Crear precio"}
        </button>
      </div>
    </form>
  );
}
