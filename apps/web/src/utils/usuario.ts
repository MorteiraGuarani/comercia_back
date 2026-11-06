import type { DatosErpUsuario, FormularioErpUsuario } from "@/types/usuario";

export function formularioErpUsuario(
  usuario?: DatosErpUsuario,
): FormularioErpUsuario {
  return {
    ERP_CanalVenta: usuario?.ERP_CanalVenta ?? "",
    ERP_Sucursal: usuario?.ERP_Sucursal?.toString() ?? "",
    ERP_CodigoAlmacen: usuario?.ERP_CodigoAlmacen ?? "",
    ERP_NombreAlmacen: usuario?.ERP_NombreAlmacen ?? "",
    ERP_CodUsuarioSap: usuario?.ERP_CodUsuarioSap ?? "",
  };
}

/** Canal y sucursal son Codes elegidos de su catálogo; sin elegir o en blanco viajan como null. */
export function datosErpFormulario(
  form: FormularioErpUsuario,
): DatosErpUsuario {
  return {
    ERP_CanalVenta: form.ERP_CanalVenta || null,
    ERP_Sucursal: form.ERP_Sucursal === "" ? null : Number(form.ERP_Sucursal),
    ERP_CodigoAlmacen: form.ERP_CodigoAlmacen.trim() || null,
    ERP_NombreAlmacen: form.ERP_NombreAlmacen.trim() || null,
    ERP_CodUsuarioSap: form.ERP_CodUsuarioSap.trim() || null,
  };
}
