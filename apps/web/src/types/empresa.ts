// Empresa como la expone GET /empresas (solo lo que el front necesita)
export interface Empresa {
  id: number;
  nombre: string;
}

export interface EmpresaAdmin extends Empresa {
  dbName: string | null;
  sapEsquema: string | null;
  sapUsuario: string | null;
  /** La contraseña de SAP nunca llega al front: solo si está cargada. */
  tieneSapContrasenia: boolean;
  /** Días antes del vencimiento en que avisa el inventario. */
  diasAvisoVencimiento: number;
  padre: { id: number; nombre: string } | null;
  usuariosCount: number;
  hijasCount: number;
  configuracionCount: number;
}
