import type {
  ACCIONES_AUDITORIA,
  ENTIDADES_AUDITORIA,
} from '../utils/auditoria';

export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];
export type EntidadAuditoria = (typeof ENTIDADES_AUDITORIA)[number];

/** Campo → valor antes y después (null si no existía). */
export type CambiosAuditoria = Record<
  string,
  { antes: unknown; despues: unknown }
>;

/** Lo que un service informa al registrar un cambio; quién lo hizo sale del pedido. */
export interface EntradaAuditoria {
  accion: AccionAuditoria;
  entidad: EntidadAuditoria;
  entidadId: string | number;
  empresaId?: number | null;
  /** Nombre legible del registro (persona, local, rol…). */
  etiqueta?: string | null;
  antes?: unknown;
  despues?: unknown;
}

export interface RegistroAuditoriaDto {
  id: number;
  creadoEn: string;
  usuarioId: number | null;
  usuarioNombre: string | null;
  usuarioRol: string | null;
  accion: string;
  entidad: string;
  entidadId: string;
  etiqueta: string | null;
  empresaId: number | null;
  empresaNombre: string | null;
  cambios: CambiosAuditoria;
}
