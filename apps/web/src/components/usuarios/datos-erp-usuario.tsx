import type { DatosErpUsuario, FormularioErpUsuario } from "@/types/usuario";
import { ERP_VENDEDOR_MAX, ERP_VENDEDOR_MIN } from "@/utils/usuario";
import { inputBase, labelBase } from "@/components/ui";

const CAMPOS_ERP = [
  { campo: "ERP_CanalVenta", etiqueta: "Canal de venta", maxLength: 50 },
  { campo: "ERP_Almacen", etiqueta: "Almacén", maxLength: 8 },
  { campo: "ERP_Supervisor", etiqueta: "Supervisor ERP", maxLength: 30 },
  { campo: "ERP_Vendedor", etiqueta: "Vendedor ERP" },
  { campo: "ERP_Repositor", etiqueta: "Repositor ERP", maxLength: 50 },
  { campo: "ERP_Impulsador", etiqueta: "Impulsador ERP", maxLength: 50 },
] as const;

export function CamposErpUsuario({
  valor,
  onChange,
  disabled,
}: {
  valor: FormularioErpUsuario;
  onChange: (campo: keyof FormularioErpUsuario, valor: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 border-t border-line pt-3"
    >
      <legend className="pr-2 text-sm font-semibold text-foreground">
        Datos ERP
      </legend>
      <p className="text-xs text-muted">
        Códigos y referencias del usuario en el ERP. Todos son opcionales y no
        modifican su rol ni su superior inmediato en Comercia.
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {CAMPOS_ERP.map((dato) => (
          <label key={dato.campo} className={`${labelBase} min-w-0`}>
            {dato.etiqueta}
            <input
              name={dato.campo}
              type={dato.campo === "ERP_Vendedor" ? "number" : "text"}
              value={valor[dato.campo]}
              onChange={(e) => onChange(dato.campo, e.target.value)}
              maxLength={"maxLength" in dato ? dato.maxLength : undefined}
              min={dato.campo === "ERP_Vendedor" ? ERP_VENDEDOR_MIN : undefined}
              max={dato.campo === "ERP_Vendedor" ? ERP_VENDEDOR_MAX : undefined}
              step={dato.campo === "ERP_Vendedor" ? 1 : undefined}
              autoComplete="off"
              className={inputBase}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DetalleErpUsuario({ usuario }: { usuario: DatosErpUsuario }) {
  if (!CAMPOS_ERP.some(({ campo }) => usuario[campo] != null)) return null;
  return (
    <details className="mt-2 min-w-0 max-w-sm">
      <summary className="min-h-11 cursor-pointer rounded py-3 text-xs font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        Datos ERP
      </summary>
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 border-t border-line py-2 text-xs sm:grid-cols-2">
        {CAMPOS_ERP.map(({ campo, etiqueta }) => (
          <div key={campo} className="min-w-0">
            <dt className="text-muted">{etiqueta}</dt>
            <dd className="break-all font-medium text-foreground">
              {usuario[campo] ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
