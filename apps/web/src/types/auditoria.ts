// Log de auditoría del backoffice (GET /admin/auditoria).

export type AccionAuditoria = "CREAR" | "MODIFICAR" | "ELIMINAR" | "ASIGNAR" | "QUITAR";

export interface RegistroAuditoria {
  id: number;
  creadoEn: string;
  usuarioId: number | null;
  usuarioNombre: string | null;
  usuarioRol: string | null;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: string;
  etiqueta: string | null;
  empresaId: number | null;
  empresaNombre: string | null;
  /** Campo → valor antes y después (null si no existía). */
  cambios: Record<string, { antes: unknown; despues: unknown }>;
}

export interface FiltrosAuditoria {
  desde: string;
  hasta: string;
  usuario: string;
  entidad: string;
  accion: AccionAuditoria | "";
}
