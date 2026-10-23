import type { MotorBd, TipoEjecutable } from '../../../generated/prisma/client';

// DTOs de SALIDA de la plataforma (forma mínima que ve el front — sin campos
// internos). Ver reglas de exposición de datos en AGENTS.md.

/** Conexión para el ABM: la contraseña nunca sale, solo si está cargada. */
export interface ConexionDto {
  id: number;
  nombre: string;
  servernode: string | null;
  userDb: string | null;
  serviceLayer: string | null;
  versionTls: string | null;
  tienePassword: boolean;
  ejecutables: number;
}

export interface EjecutableDto {
  id: number;
  nombre: string;
  tipo: TipoEjecutable;
  motor: MotorBd;
  conexionId: number | null;
  sentencia: string;
  orden: number;
  activo: boolean;
}

export interface PaginaDto {
  id: number;
  moduloId: number;
  nombre: string;
  ruta: string;
  icono: string | null;
  orden: number;
  activo: boolean;
  ejecutables?: EjecutableDto[];
}

export interface ModuloDto {
  id: number;
  nombre: string;
  ruta: string;
  icono: string | null;
  orden: number;
  activo: boolean;
  paginas?: PaginaDto[];
}

// --- Menú del usuario (endpoint /mi-plataforma) ---
export interface PaginaMenu {
  id: number;
  nombre: string;
  ruta: string;
  icono: string | null;
}

export interface ModuloMenu {
  id: number;
  nombre: string;
  ruta: string;
  icono: string | null;
  paginas: PaginaMenu[];
}
