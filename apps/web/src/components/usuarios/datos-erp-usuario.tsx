import type { FormularioErpUsuario, UsuarioAdmin } from "@/types/usuario";
import { SelectorPaginado } from "@/components/selector-paginado";
import { inputBase, labelBase } from "@/components/ui";

/** Pestaña SAP: canal de venta (tbl_jcanales), sucursal (tbl_oclp) y usuario SAP. */
export function CamposErpUsuario({
  base,
  empresaId,
  usuario,
  valor,
  onChange,
  disabled,
}: {
  base: string;
  empresaId: number;
  /** El que se edita: da el nombre de lo ya elegido aunque no esté en la página. */
  usuario?: UsuarioAdmin;
  valor: FormularioErpUsuario;
  onChange: (campo: keyof FormularioErpUsuario, valor: string) => void;
  disabled: boolean;
}) {
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
        <label className={`${labelBase} sm:col-span-2`}>
          Código de usuario SAP
          <input
            value={valor.ERP_CodUsuarioSap}
            onChange={(e) => onChange("ERP_CodUsuarioSap", e.target.value)}
            maxLength={100}
            autoComplete="off"
            className={inputBase}
          />
        </label>
      </div>
    </fieldset>
  );
}

export function DetalleErpUsuario({ usuario }: { usuario: UsuarioAdmin }) {
  const datos = [
    ["Canal de venta", usuario.canalVentaNombre, usuario.ERP_CanalVenta],
    ["Sucursal", usuario.sucursalNombre, usuario.ERP_Sucursal],
    ["Almacén", usuario.ERP_NombreAlmacen, usuario.ERP_CodigoAlmacen],
    ["Usuario SAP", null, usuario.ERP_CodUsuarioSap],
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
