import type { AccionAuditoria, FiltrosAuditoria } from "@/types/auditoria";
import { agregarDiasIso, fechaInputAIso, formatoFecha, formatoFechaHora } from "@/utils/fechas";

export const ACCIONES_AUDITORIA: { valor: AccionAuditoria; texto: string }[] = [
  { valor: "CREAR", texto: "Alta" },
  { valor: "MODIFICAR", texto: "Modificación" },
  { valor: "ELIMINAR", texto: "Baja" },
  { valor: "ASIGNAR", texto: "Asignación" },
  { valor: "QUITAR", texto: "Quita" },
];

// Las mismas que acepta la API (common/utils/auditoria.ts).
export const ENTIDADES_AUDITORIA = [
  "Usuario",
  "Rol",
  "Acceso por empresa",
  "Categoría",
  "Empresa",
  "Horario",
  "Asignación",
  "Backup",
  "Local",
  "Tarea",
];

export const textoAccion = (accion: AccionAuditoria) =>
  ACCIONES_AUDITORIA.find((a) => a.valor === accion)?.texto ?? accion;

/** Query de la API: los días se toman de 00:00 a 00:00 en la hora del equipo. */
export function consultaAuditoria(f: FiltrosAuditoria): string {
  const q = new URLSearchParams();
  const desde = f.desde && fechaInputAIso(`${f.desde}T00:00`);
  const hasta = f.hasta && fechaInputAIso(`${agregarDiasIso(f.hasta, 1)}T00:00`);
  if (desde) q.set("desde", desde);
  if (hasta) q.set("hasta", hasta);
  if (f.usuario.trim()) q.set("usuario", f.usuario.trim());
  if (f.entidad) q.set("entidad", f.entidad);
  if (f.accion) q.set("accion", f.accion);
  return q.toString();
}

/** Valor legible de un campo del antes/después. */
export function valorAuditoria(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string") {
    // Las fechas sin hora (vigencias) llegan a medianoche UTC: se muestran tal cual.
    if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(v))
      return formatoFecha(`${v.slice(0, 10)}T12:00:00`);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return formatoFechaHora(v);
    return v;
  }
  if (Array.isArray(v)) return v.length ? v.map(valorAuditoria).join(", ") : "—";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.nombre === "string" && typeof o.apellido === "string")
      return `${o.nombre} ${o.apellido}`.trim();
    for (const clave of ["descripcion", "nombre", "CardName"])
      if (typeof o[clave] === "string") return o[clave] as string;
    if (o.local && typeof o.local === "object") return valorAuditoria(o.local);
    return JSON.stringify(v);
  }
  return String(v);
}
