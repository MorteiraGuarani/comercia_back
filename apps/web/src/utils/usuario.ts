import type { DatosErpUsuario, FormularioErpUsuario } from "@/types/usuario";

export const ERP_VENDEDOR_MIN = -2147483648;
export const ERP_VENDEDOR_MAX = 2147483647;

export function formularioErpUsuario(
  usuario?: DatosErpUsuario,
): FormularioErpUsuario {
  return {
    ERP_CanalVenta: usuario?.ERP_CanalVenta ?? "",
    ERP_Almacen: usuario?.ERP_Almacen ?? "",
    ERP_Supervisor: usuario?.ERP_Supervisor ?? "",
    ERP_Vendedor: usuario?.ERP_Vendedor?.toString() ?? "",
    ERP_Repositor: usuario?.ERP_Repositor ?? "",
    ERP_Impulsador: usuario?.ERP_Impulsador ?? "",
  };
}

/** Los campos vacíos se envían como null, también al limpiar una edición. */
export function datosErpFormulario(
  form: FormularioErpUsuario,
): DatosErpUsuario {
  const vendedor =
    form.ERP_Vendedor.trim() === "" ? null : Number(form.ERP_Vendedor);
  if (
    vendedor !== null &&
    (!Number.isInteger(vendedor) ||
      vendedor < ERP_VENDEDOR_MIN ||
      vendedor > ERP_VENDEDOR_MAX)
  ) {
    throw new Error("El vendedor ERP debe ser un número entero de 32 bits.");
  }
  return {
    ERP_CanalVenta: form.ERP_CanalVenta.trim() || null,
    ERP_Almacen: form.ERP_Almacen.trim() || null,
    ERP_Supervisor: form.ERP_Supervisor.trim() || null,
    ERP_Vendedor: vendedor,
    ERP_Repositor: form.ERP_Repositor.trim() || null,
    ERP_Impulsador: form.ERP_Impulsador.trim() || null,
  };
}
