import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FormularioErpUsuario, UsuarioAdmin } from "@/types/usuario";
import type { OpcionSelector } from "@/types/opcion-selector";
import { SelectorPaginado } from "@/components/selector-paginado";
import { apiFetch } from "@/lib/api";

/** Pestaña SAP: canal de venta (tbl_jcanales), sucursal (tbl_oclp) y Código Vendedor (tbl_oslp). */
export function CamposErpUsuario({
  base,
  empresaId,
  usuario,
  legajo,
  valor,
  onChange,
  disabled,
}: {
  base: string;
  empresaId: number;
  /** El que se edita: da el nombre de lo ya elegido aunque no esté en la página. */
  usuario?: UsuarioAdmin;
  /** Sin Código Vendedor, se propone el de tbl_oslp cuyo Fax coincide con el legajo. */
  legajo: string;
  valor: FormularioErpUsuario;
  onChange: (campo: keyof FormularioErpUsuario, valor: string) => void;
  disabled: boolean;
}) {
  const [sugerido, setSugerido] = useState<string>();
  const intentado = useRef("");
  const sinVendedor = valor.ERP_CodUsuarioSap === "";
  const legajoLimpio = legajo.trim();
  // El padre pasa un onChange nuevo en cada render: no debe cortar la consulta.
  const proponer = useEffectEvent((opcion: OpcionSelector) => {
    setSugerido(opcion.nombre);
    onChange("ERP_CodUsuarioSap", String(opcion.id));
  });
  useEffect(() => {
    const clave = `${empresaId}|${legajoLimpio}`;
    // Una sola propuesta por legajo: si la borra, no vuelve a aparecer.
    if (!sinVendedor || !legajoLimpio || intentado.current === clave) return;
    intentado.current = clave;
    const control = new AbortController();
    const params = new URLSearchParams({
      empresaId: String(empresaId),
      legajo: legajoLimpio,
    });
    apiFetch<OpcionSelector | null>(
      `${base}/vendedores-sap/sugerido?${params}`,
      { signal: control.signal },
    )
      .then((opcion) => {
        if (opcion) proponer(opcion);
      })
      // Sin sugerencia el campo queda vacío para elegir a mano.
      .catch(() => undefined);
    return () => control.abort();
  }, [base, empresaId, legajoLimpio, sinVendedor]);

  const campos = [
    {
      campo: "ERP_CanalVenta",
      etiqueta: "Canal de venta",
      url: `${base}/canales-venta?empresaId=${empresaId}`,
      nombre: usuario?.canalVentaNombre,
    },
    {
      campo: "ERP_Sucursal",
      etiqueta: "Sucursal",
      url: `${base}/sucursales?empresaId=${empresaId}`,
      nombre: usuario?.sucursalNombre,
    },
  ] as const;
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="pr-2 text-sm font-semibold text-foreground">
        Datos SAP (ERP)
      </legend>
      <p className="text-xs text-muted">
        Opcionales: no modifican su rol ni su superior inmediato en Comercia.
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {campos.map((dato) => (
          <SelectorPaginado
            key={`${dato.campo}-${empresaId}-${usuario?.id ?? "nuevo"}`}
            url={dato.url}
            etiqueta={dato.etiqueta}
            value={valor[dato.campo] === "" ? "" : Number(valor[dato.campo])}
            seleccionActual={dato.nombre ?? undefined}
            onChange={(id) => onChange(dato.campo, String(id))}
            // Catálogos cortos: select nativo como Rol, el modal no recorta sus opciones.
            vacio="Sin asignar"
            limite={50}
          />
        ))}
        <div className="min-w-0 sm:col-span-2">
          <SelectorPaginado
            key={`vendedor-${empresaId}-${usuario?.id ?? "nuevo"}`}
            url={`${base}/vendedores-sap?empresaId=${empresaId}`}
            etiqueta="Código Vendedor"
            placeholder="Buscá por nombre o legajo"
            buscable
            limpiable
            conDescripcion
            value={sinVendedor ? "" : Number(valor.ERP_CodUsuarioSap)}
            seleccionActual={
              sugerido ?? usuario?.vendedorSapNombre ?? undefined
            }
            onChange={(id) => onChange("ERP_CodUsuarioSap", String(id))}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function DetalleErpUsuario({ usuario }: { usuario: UsuarioAdmin }) {
  const datos = [
    ["Canal de venta", usuario.canalVentaNombre, usuario.ERP_CanalVenta],
    ["Sucursal", usuario.sucursalNombre, usuario.ERP_Sucursal],
    ["Almacén", usuario.ERP_NombreAlmacen, usuario.ERP_CodigoAlmacen],
    ["Código Vendedor", usuario.vendedorSapNombre, usuario.ERP_CodUsuarioSap],
  ] as const;
  if (datos.every(([, nombre, code]) => nombre == null && code == null))
    return null;
  return (
    <details className="mt-2 min-w-0 max-w-sm">
      <summary className="min-h-11 cursor-pointer rounded py-3 text-xs font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        Datos SAP (ERP)
      </summary>
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 border-t border-line py-2 text-xs sm:grid-cols-2">
        {datos.map(([etiqueta, nombre, code]) => (
          <div key={etiqueta} className="min-w-0">
            <dt className="text-muted">{etiqueta}</dt>
            <dd className="break-all font-medium text-foreground">
              {code == null
                ? (nombre ?? "—")
                : `${nombre ?? "Código"} · ${code}`}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
